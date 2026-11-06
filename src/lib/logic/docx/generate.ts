import JSZip from "jszip";
import { analyzeSourceXml, buildVariant, loadDocxXml } from "./legacy-mixer";

// Fresh orchestration glue around the ported legacy-mixer pipeline — this
// file is NOT a port, it's new code that wires the ported functions
// together for the Next.js UI. Runs entirely client-side (DOMParser,
// XMLSerializer, JSZip are browser APIs), matching the "DOCX processing
// stays client-side" decision in the migration plan.

export interface GenerateExamVariantsOptions {
  /** How many exam-code variants to produce when `codes` isn't given. */
  variantCount: number;
  /** Explicit exam codes, e.g. ["101","102","103"]. Overrides variantCount. */
  codes?: string[];
  /** Shuffle MCQ (A-D) choices per question. Mirrors the legacy opts.shuffleChoices. Default true. */
  shuffleChoices?: boolean;
  /** Skip shuffling True/False sub-items. Mirrors opts.dontShuffleTF. Default false. */
  dontShuffleTF?: boolean;
  /** Renumber questions sequentially in the output. Mirrors opts.renumber. Default true. */
  renumber?: boolean;
  /** 'standard' re-lays-out the exam into ExamMix's standard formatting;
   *  'keep' preserves the source document's own formatting as much as
   *  possible. Mirrors opts.outputStyle. Default 'keep'. */
  outputStyle?: "standard" | "keep";
  /** Comma-separated cluster sizes for grouped/locked question blocks
   *  (rarely needed) — mirrors opts.groupSizes. Default "" (no groups). */
  groupSizes?: string;
  /** Exam title shown in an injected header table, if opts.injectHeader is used later. */
  examName?: string;
}

export interface GeneratedExamVariant {
  code: string;
  /** The student exam (shuffled), as a ready-to-download .docx blob. */
  blob: Blob;
  /** A black-and-white print-friendly variant of the same exam. */
  printBlob: Blob;
  /** The answer key / essay-answer document for this variant, if any
   *  essay questions were present (buildVariant always returns essayAnswerXml,
   *  it may just be an empty shell when there are no essay questions). */
  essayAnswerBlob: Blob;
  /** Per-question answers and the renumbering matrix, straight from buildVariant. */
  answers: unknown;
  matrixRows: unknown;
}

function defaultCodes(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(101 + i));
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
  file: File,
  options: GenerateExamVariantsOptions,
): Promise<GeneratedExamVariant[]> {
  const { zip, xml } = await loadDocxXml(file, file.name);

  // Analyze once — reused for every variant, matching the legacy UI's
  // "phân tích đề gốc" step that only runs a single time per upload.
  const analysis = analyzeSourceXml(xml, { autoDetect: true });
  if (Array.isArray(analysis.fatalErrors) && analysis.fatalErrors.length > 0) {
    throw new Error(analysis.fatalErrors.join(" "));
  }

  const codes =
    options.codes && options.codes.length > 0
      ? options.codes
      : defaultCodes(options.variantCount);

  const opts = {
    englishBlockMode: true,
    groupSizes: options.groupSizes ?? "",
    shuffleChoices: options.shuffleChoices ?? true,
    dontShuffleTF: options.dontShuffleTF ?? false,
    renumber: options.renumber ?? true,
    outputStyle: options.outputStyle ?? "keep",
    standardPage: false,
    keepStructure: false,
    centerImages: true,
    normalizeFont: false,
    injectHeader: false,
    removeOldHeader: false,
    colorWordLabelsBlue: false,
  };

  const results: GeneratedExamVariant[] = [];

  // Reuse the single JSZip instance loaded above: each generateAsync call
  // overwrites the SAME word/document.xml entry (not appended), so there's
  // no cross-variant state leakage — every other part of the archive
  // (styles, media, rels) is read once and shared as-is, exactly like the
  // legacy exammixDownloadMarkedOriginal pattern (z.file('word/document.xml',
  // ...) then z.generateAsync(...)). This avoids re-reading/unzipping the
  // whole .docx per variant.
  //
  // IMPORTANT: the three zipWithDocumentXml calls below MUST run
  // sequentially, not via Promise.all — they all write to the same path on
  // the same shared zip object, and JSZip's generateAsync reads file
  // content lazily as it serializes rather than snapshotting it the moment
  // .file() is called. Running them concurrently would let a later
  // .file() overwrite win before an earlier generateAsync() has finished
  // reading, corrupting the output.
  for (const code of codes) {
    const variant = buildVariant(xml, opts, analysis, {
      code,
      examName: options.examName,
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
    });
  }

  return results;
}
