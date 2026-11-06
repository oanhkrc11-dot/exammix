import JSZip from "jszip";
import { buildXlsxBlob } from "@/lib/logic/xlsx";
import {
  analyzeSourceXml,
  buildVariant,
  loadDocxXml,
  wNode,
  makeWParagraph,
  W_NS,
} from "./legacy-mixer";

// Fresh orchestration glue around the ported legacy-mixer pipeline — this
// file is NOT a port, it's new code that wires the ported functions
// together for the Next.js UI. Runs entirely client-side (DOMParser,
// XMLSerializer, JSZip are browser APIs), matching the "DOCX processing
// stays client-side" decision in the migration plan.
//
// buildVariant/analyzeSourceXml already accept every option the legacy
// "Trộn đề thi" screen exposes (em217 question selector, fixed-item
// locking, header injection, English-block mixing, etc.) — this file's
// job is only to default/forward them and to add the handful of new
// *export-bundling* outputs (merged docx, answer-key docx/xlsx, TNMaker
// QR) that legacy's startMix() built but that weren't part of the
// parse/shuffle core traced into legacy-mixer.ts.

export interface ManualAnswerInput {
  mcq?: string;
  tf?: string;
  short?: string;
  autoDetect?: boolean;
  englishBlockMode?: boolean;
}

export interface SourceAnalysis {
  zip: JSZip;
  xml: string;
  fileName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any;
}

export async function analyzeSource(
  file: File,
  manual: ManualAnswerInput = {},
): Promise<SourceAnalysis> {
  const { zip, xml } = await loadDocxXml(file, file.name);
  const analysis = analyzeSourceXml(xml, manual);
  return { zip, xml, fileName: file.name, analysis };
}

export interface ExamHeaderInfo {
  agency?: string;
  examName?: string;
  school?: string;
  subject?: string;
  dept?: string;
  duration?: string;
  examType?: string;
  injectHeader?: boolean;
  removeOldHeader?: boolean;
  candidateInfo?: boolean;
}

export interface GenerateExamVariantsOptions extends ExamHeaderInfo {
  /** How many exam-code variants to produce when `codes` isn't given. */
  variantCount: number;
  /** Explicit exam codes, e.g. ["101","102","103"]. Overrides the auto sequence. */
  codes?: string[];
  /** First auto-generated code, default "101". Mirrors legacy `firstCode`. */
  firstCode?: string;
  /** Step between auto-generated codes, default 1. Mirrors legacy `codeStep`. */
  codeStep?: number;
  /** Pad auto-generated codes to 4 digits. Mirrors legacy `fourDigits`. */
  fourDigits?: boolean;
  /** Shuffle MCQ (A-D) choices per question. Default true. */
  shuffleChoices?: boolean;
  /** Skip shuffling True/False sub-items. Default false. */
  dontShuffleTF?: boolean;
  /** Renumber questions sequentially in the output. Default true. */
  renumber?: boolean;
  /** 'standard' re-lays-out the exam into ExamMix's standard formatting;
   *  'keep' preserves the source document's own formatting. Default 'keep'. */
  outputStyle?: "standard" | "keep";
  /** Comma-separated cluster sizes for grouped/locked question blocks. */
  groupSizes?: string;
  /** Mix Tiếng Anh theo khối (Reading/Cloze/Arrangement blocks stay intact). Default true. */
  englishBlockMode?: boolean;
  /** Strip inline "lời giải"/"TL:" solution text from the student copy. */
  removeSolutions?: boolean;
  /** Lock every True/False sub-item of the questions matched by fixedQuestionNums. */
  fixedAllTFItems?: boolean;
  /** "II:5, 12" — which questions' TF items (or whole questions) stay fixed. */
  fixedQuestionNums?: string;
  /** Lock only the specific a/b/c/d sub-items listed in fixedTFItems. */
  fixedSpecificTFItems?: boolean;
  /** "II:5:a, 12:b" — specific True/False sub-items to lock in place. */
  fixedTFItems?: string;
  /** originalIndex set from SourceAnalysis — restrict mixing to just these questions. */
  selectedQuestionIds?: number[];
  standardPage?: boolean;
  keepStructure?: boolean;
  centerImages?: boolean;
  normalizeFont?: boolean;
  colorWordLabelsBlue?: boolean;
}

export interface MixAnswers {
  mcq: string[];
  tf: string[];
  short: string[];
  essay: { Cau: number; Text: string }[];
}

export interface GeneratedExamVariant {
  code: string;
  /** The student exam (shuffled), as a ready-to-download .docx blob. */
  blob: Blob;
  /** A black-and-white print-friendly variant of the same exam. */
  printBlob: Blob;
  /** The essay-answer document for this variant (may be an empty shell). */
  essayAnswerBlob: Blob;
  /** Per-question answers and the renumbering matrix, straight from buildVariant. */
  answers: MixAnswers;
  matrixRows: unknown[];
  /** Raw XML, kept around so export-bundling (merge/answer-doc) can reuse it. */
  outXml: string;
  printXml: string;
}

export function buildCodeList(opts: {
  variantCount: number;
  codes?: string[];
  firstCode?: string;
  codeStep?: number;
  fourDigits?: boolean;
}): string[] {
  if (opts.codes && opts.codes.length > 0) return opts.codes;
  const first = Number(opts.firstCode) || 101;
  const step = Number(opts.codeStep) || 1;
  return Array.from({ length: opts.variantCount }, (_, i) => {
    const n = first + i * step;
    return opts.fourDigits ? String(n).padStart(4, "0") : String(n);
  });
}

/** Parse the free-text "tự chọn mã đề" textarea: comma/semicolon/newline separated. */
export function parseCustomCodes(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function zipWithDocumentXml(baseZip: JSZip, xml: string): Promise<Blob> {
  baseZip.file("word/document.xml", xml);
  return baseZip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function generateExamVariants(
  source: SourceAnalysis,
  options: GenerateExamVariantsOptions,
): Promise<GeneratedExamVariant[]> {
  const { zip, xml, analysis } = source;
  if (Array.isArray(analysis.fatalErrors) && analysis.fatalErrors.length > 0) {
    throw new Error(analysis.fatalErrors.join(" "));
  }

  const codes = buildCodeList(options);

  const opts = {
    englishBlockMode: options.englishBlockMode ?? true,
    groupSizes: options.groupSizes ?? "",
    em217SelectedIds:
      options.selectedQuestionIds && options.selectedQuestionIds.length > 0
        ? new Set(options.selectedQuestionIds)
        : undefined,
    shuffleChoices: options.shuffleChoices ?? true,
    dontShuffleTF: options.dontShuffleTF ?? false,
    renumber: options.renumber ?? true,
    outputStyle: options.outputStyle ?? "keep",
    standardPage: options.standardPage ?? false,
    keepStructure: options.keepStructure ?? false,
    centerImages: options.centerImages ?? true,
    normalizeFont: options.normalizeFont ?? false,
    injectHeader: options.injectHeader ?? false,
    removeOldHeader: options.removeOldHeader ?? false,
    colorWordLabelsBlue: options.colorWordLabelsBlue ?? false,
    removeSolutions: options.removeSolutions ?? false,
    fixedAllTFItems: options.fixedAllTFItems ?? false,
    fixedQuestionNums: options.fixedQuestionNums ?? "",
    fixedSpecificTFItems: options.fixedSpecificTFItems ?? false,
    fixedTFItems: options.fixedTFItems ?? "",
  };

  const headerInfo: ExamHeaderInfo = {
    agency: options.agency,
    examName: options.examName,
    school: options.school,
    subject: options.subject,
    dept: options.dept,
    duration: options.duration,
    examType: options.examType,
    candidateInfo: options.candidateInfo,
  };

  const results: GeneratedExamVariant[] = [];

  // Reuse the single JSZip instance loaded above: each generateAsync call
  // overwrites the SAME word/document.xml entry (not appended), so there's
  // no cross-variant state leakage — every other part of the archive
  // (styles, media, rels) is read once and shared as-is, exactly like the
  // legacy exammixDownloadMarkedOriginal pattern.
  //
  // IMPORTANT: the zipWithDocumentXml calls below MUST run sequentially,
  // not via Promise.all — they all write to the same path on the same
  // shared zip object, and JSZip's generateAsync reads file content
  // lazily as it serializes rather than snapshotting it the moment
  // .file() is called. Running them concurrently would let a later
  // .file() overwrite win before an earlier generateAsync() has finished
  // reading, corrupting the output. The same constraint applies to the
  // export-bundling helpers below (buildAnswerKeyDocxBlob/buildMergedDocxBlob),
  // which reuse this same `zip` instance after this loop finishes.
  for (const code of codes) {
    const variant = buildVariant(xml, opts, analysis, {
      ...headerInfo,
      code,
    });

    const blob = await zipWithDocumentXml(zip, variant.outXml);
    const printBlob = await zipWithDocumentXml(zip, variant.printXml);
    const essayAnswerBlob = await zipWithDocumentXml(zip, variant.essayAnswerXml);

    results.push({
      code,
      blob,
      printBlob,
      essayAnswerBlob,
      answers: variant.answers,
      matrixRows: variant.matrixRows,
      outXml: variant.outXml,
      printXml: variant.printXml,
    });
  }

  return results;
}

/** Build just the first code's variant — backs the "Xem thử mã đầu" preview button. */
export async function previewFirstVariant(
  source: SourceAnalysis,
  options: GenerateExamVariantsOptions,
): Promise<GeneratedExamVariant> {
  const codes = buildCodeList(options);
  const [first] = await generateExamVariants(source, { ...options, codes: [codes[0]] });
  return first;
}

// ---------------------------------------------------------------------------
// Export-bundling outputs. None of these existed in the legacy call-graph
// trace that produced legacy-mixer.ts (they're startMix()'s ZIP-assembly
// tail, not part of the parse/shuffle core) — written fresh here, reusing
// the exported OOXML node builders (wNode/makeWParagraph) and the existing
// generic xlsx writer so no new zip-skeleton code has to be hand-rolled.
// ---------------------------------------------------------------------------

export interface AnswerKeyRow {
  code: string;
  mcq: string;
  tf: string;
  short: string;
}

export function buildAnswerKeyRows(variants: GeneratedExamVariant[]): AnswerKeyRow[] {
  return variants.map((v) => ({
    code: v.code,
    mcq: v.answers.mcq.join(""),
    tf: v.answers.tf.join(" "),
    short: v.answers.short.join("; "),
  }));
}

export async function buildAnswerExcelBlob(rows: AnswerKeyRow[]): Promise<Blob> {
  const header = ["Mã đề", "Phần I (A-D)", "Phần II (Đ-S)", "Phần III"];
  const data = rows.map((r) => [r.code, r.mcq, r.tf, r.short]);
  return buildXlsxBlob("DapAn", header, data);
}

function getBody(doc: Document): Element {
  const body = doc.getElementsByTagNameNS("*", "body")[0];
  if (!body) throw new Error("Không tìm thấy body Word.");
  return body;
}

/** A simple Word answer-key document, listing each code's Phần I/II/III answers. */
export async function buildAnswerKeyDocxBlob(
  variants: GeneratedExamVariant[],
  zip: JSZip,
  header: ExamHeaderInfo,
): Promise<Blob> {
  const doc = new DOMParser().parseFromString(variants[0].outXml, "application/xml");
  const body = getBody(doc);
  const sectPr = body.getElementsByTagNameNS("*", "sectPr")[0]?.cloneNode(true);
  while (body.firstChild) body.removeChild(body.firstChild);

  body.appendChild(
    makeWParagraph(doc, `ĐÁP ÁN${header.examName ? " — " + header.examName : ""}`, {
      align: "center",
      bold: true,
      size: 28,
      after: 200,
    }),
  );

  buildAnswerKeyRows(variants).forEach((row) => {
    body.appendChild(
      makeWParagraph(doc, `MÃ ĐỀ ${row.code}`, { bold: true, size: 24, before: 160, after: 80 }),
    );
    if (row.mcq) body.appendChild(makeWParagraph(doc, `Phần I: ${row.mcq}`, { size: 22, after: 40 }));
    if (row.tf) body.appendChild(makeWParagraph(doc, `Phần II: ${row.tf}`, { size: 22, after: 40 }));
    if (row.short) body.appendChild(makeWParagraph(doc, `Phần III: ${row.short}`, { size: 22, after: 40 }));
  });

  if (sectPr) body.appendChild(sectPr);
  const xml = new XMLSerializer().serializeToString(doc);
  return zipWithDocumentXml(zip, xml);
}

/** Concatenate every variant's body into one combined Word file (page break between each). */
export async function buildMergedDocxBlob(
  variants: GeneratedExamVariant[],
  zip: JSZip,
  usePrintVersion: boolean,
): Promise<Blob> {
  const doc = new DOMParser().parseFromString(
    usePrintVersion ? variants[0].printXml : variants[0].outXml,
    "application/xml",
  );
  const body = getBody(doc);
  const sectPr = body.getElementsByTagNameNS("*", "sectPr")[0]?.cloneNode(true);
  while (body.firstChild) body.removeChild(body.firstChild);

  variants.forEach((v, i) => {
    if (i > 0) {
      const breakPara = wNode(doc, "p");
      const run = wNode(doc, "r");
      run.appendChild(wNode(doc, "br", { type: "page" }));
      breakPara.appendChild(run);
      body.appendChild(breakPara);
    }
    const srcXml = usePrintVersion ? v.printXml : v.outXml;
    const srcDoc = new DOMParser().parseFromString(srcXml, "application/xml");
    const srcBody = getBody(srcDoc);
    Array.from(srcBody.childNodes).forEach((node) => {
      if (node.nodeType === 1 && (node as Element).localName === "sectPr") return;
      body.appendChild(doc.importNode(node, true));
    });
  });

  if (sectPr) body.appendChild(doc.importNode(sectPr, true));
  const xml = new XMLSerializer().serializeToString(doc);
  return zipWithDocumentXml(zip, xml);
}

/** Mirrors legacy makeTNMakerPayload (index.html → startMix): one QR/JSON per batch, keyed by code. */
export function buildTNMakerPayload(rows: AnswerKeyRow[]): Record<string, unknown> {
  const payload: Record<string, unknown> = { success: true, type: 5 };
  [...rows]
    .sort((a, b) => a.code.localeCompare(b.code, "vi", { numeric: true }))
    .forEach((r) => {
      const p1 = r.mcq.toUpperCase().replace(/[^A-D?]/g, "");
      const p2 = r.tf
        .split(" ")
        .map((x) => (x || "????").toUpperCase().replace(/T/g, "Đ").replace(/[^ĐS?]/g, "") || "????")
        .join("_");
      const p3 = r.short
        .split(";")
        .map((x) => x.trim() || "?")
        .join("_");
      let value = p1;
      if (p2) value += "#" + p2;
      if (p3) value += (p2 ? "#" : "##") + p3;
      payload[r.code] = value;
    });
  return payload;
}

export async function buildTNMakerQrAssets(
  rows: AnswerKeyRow[],
): Promise<{ json: string; pngDataUrl: string }> {
  const QRCode = (await import("qrcode")).default;
  const json = JSON.stringify(buildTNMakerPayload(rows));
  const pngDataUrl = await QRCode.toDataURL(json, { margin: 1, width: 512 });
  return { json, pngDataUrl };
}

export function buildPrintManifestText(
  variants: GeneratedExamVariant[],
  order: "asc" | "desc" | "custom" = "asc",
): string {
  const codes = variants.map((v) => v.code);
  const ordered = order === "desc" ? [...codes].reverse() : codes;
  return ["DANH SÁCH THỨ TỰ IN", ...ordered.map((c, i) => `${i + 1}. Mã đề ${c}`)].join("\n");
}

export interface ExportSelection {
  outDocx?: boolean;
  outAnswerDoc?: boolean;
  outExcel?: boolean;
  outMergedDocx?: boolean;
  outMergedPrintDocx?: boolean;
  outTNMakerQR?: boolean;
  outPrintManifest?: boolean;
  outEssayAnswerDoc?: boolean;
  printOrder?: "asc" | "desc" | "custom";
}

/** Assembles the single ZIP download produced by "TRỘN & XUẤT ĐỀ" — mirrors legacy startMix()'s outputZip. */
export async function buildExportZip(
  variants: GeneratedExamVariant[],
  sourceZip: JSZip,
  selection: ExportSelection,
  header: ExamHeaderInfo,
): Promise<Blob> {
  const out = new JSZip();
  const rows = buildAnswerKeyRows(variants);

  if (selection.outDocx ?? true) {
    variants.forEach((v) => out.file(`De_${v.code}.docx`, v.blob));
  }
  if (selection.outEssayAnswerDoc) {
    variants.forEach((v) => out.file(`De_${v.code}_DapAnTuLuan.docx`, v.essayAnswerBlob));
  }
  if (selection.outAnswerDoc) {
    out.file("Dap_an.docx", await buildAnswerKeyDocxBlob(variants, sourceZip, header));
  }
  if (selection.outExcel) {
    out.file("Dap_an_Excel_NHAP_CHAM_TNMaker.xlsx", await buildAnswerExcelBlob(rows));
  }
  if (selection.outMergedDocx) {
    out.file("De_ghep.docx", await buildMergedDocxBlob(variants, sourceZip, false));
  }
  if (selection.outMergedPrintDocx) {
    out.file("De_ghep_DE_IN.docx", await buildMergedDocxBlob(variants, sourceZip, true));
  }
  if (selection.outTNMakerQR) {
    const { json, pngDataUrl } = await buildTNMakerQrAssets(rows);
    const base64 = pngDataUrl.split(",")[1] ?? "";
    out.folder("QR_TNMAKER")?.file("Dap_an_QR_NHAP_CHAM_TNMaker.png", base64, { base64: true });
    out.folder("QR_TNMAKER")?.file("Dap_an_QR_NHAP_CHAM_TNMaker.json", json);
  }
  if (selection.outPrintManifest) {
    out.file("Thu_tu_in.txt", buildPrintManifestText(variants, selection.printOrder));
  }

  return out.generateAsync({ type: "blob", mimeType: "application/zip" });
}

export { W_NS };
