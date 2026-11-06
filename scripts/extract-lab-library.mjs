import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";

const SRC = "legacy/index.html";
const OUT_DIR = "public/lab-library";
const META_OUT = "src/lib/lab-library.ts";

mkdirSync(OUT_DIR, { recursive: true });

const text = readFileSync(SRC, "utf8");
const lines = text.split("\n");

// (name, startLine 1-indexed) in source order, boundary list ends with the
// first non-content function so we know where embedCuratedPhysics13UploadsV20 ends.
const FUNCS = [
  ["embedPhysicsPresets", 9269],
  ["embedCuratedLabs", 9279],
  ["embedLesson4Demos", 9302],
  ["embedLesson5Demos", 9303],
  ["embedLesson678Demos", 9304],
  ["embedLesson1011Demos", 9305],
  ["embedLesson9Demos", 9306],
  ["embedCuratedGames", 9307],
  ["embedLesson1213Demos", 9323],
  ["embedLesson2025Demos", 9324],
  ["embedLesson1619Demos", 9325],
  ["embedLesson15Demos", 9326],
  ["embedLesson14Demos", 9327],
  ["embedLesson2629Demos", 9328],
  ["embedLesson3033Demos", 9329],
  ["embedLessonExtras20261027", 9330],
  ["embedLesson34AndSupplements", 9331],
  ["embedNewCuratedPhysics10Demos", 9332],
  ["embedLessonNewCurated20261027", 9333],
  ["embedNewPhysics1112Batch", 9334],
  ["embedPhysics11ElectricAdditional", 9335],
  ["embedPhysics11Electric6783", 9336],
  ["embedArchivePhysics20261027", 9338],
  ["embedEntertainmentGames20261027", 9340],
  ["embedRubikEntertainment20261027", 9341],
  ["embedCuratedPhysics13UploadsV20", 9344],
  ["__END__", 9486],
];

function sandboxBase() {
  const ctx = {
    EMBED_CURATED_VERSION: "8.1.4",
    embedDecodeB64(s) {
      return Buffer.from(s, "base64").toString("utf-8");
    },
    embedId(prefix) {
      return prefix + "_fixed_id";
    },
    Date,
    Math,
    console,
  };
  return vm.createContext(ctx);
}

function sanitizeId(id, fallbackIndex) {
  const safe = String(id || `entry_${fallbackIndex}`).replace(/[^A-Za-z0-9_-]/g, "_");
  return safe || `entry_${fallbackIndex}`;
}

const allEntries = [];
let totalFiles = 0;
const failures = [];
let runningIdCounter = 0;

for (let i = 0; i < FUNCS.length - 1; i++) {
  const [name, startLine] = FUNCS[i];
  const endLine = FUNCS[i + 1][1]; // exclusive, 1-indexed
  const slice = lines.slice(startLine - 1, endLine - 1).join("\n");
  const preamble = lines.slice(9249, 9260).join("\n"); // const CUR_*_B64 declarations (lines 9250-9260)

  const code = `(function(){\n${preamble}\n${slice}\nreturn ${name}();\n})()`;

  let result;
  try {
    const ctx = sandboxBase();
    result = vm.runInContext(code, ctx, { timeout: 30000 });
  } catch (e) {
    failures.push(`${name}: eval failed: ${e.message}`);
    console.log(`[FAIL] ${name}: ${e.message}`);
    continue;
  }

  if (!Array.isArray(result)) {
    failures.push(`${name}: did not return an array (got ${typeof result})`);
    console.log(`[FAIL] ${name}: not an array`);
    continue;
  }

  let countThisFn = 0;
  for (const entry of result) {
    runningIdCounter++;
    const id = sanitizeId(entry.id, runningIdCounter);
    const html = typeof entry.html === "string" ? entry.html : "";

    if (html.trim().length > 0) {
      writeFileSync(`${OUT_DIR}/${id}.html`, html, "utf-8");
      totalFiles++;
    }

    allEntries.push({
      id,
      kind: entry.kind === "game" ? "game" : "lab",
      subject: entry.subject || "",
      grade: entry.grade ?? "",
      lessonId: entry.lessonId || undefined,
      title: entry.title || "",
      description: entry.description || "",
      sourceName: entry.sourceName || undefined,
      hasContent: html.trim().length > 0,
    });
    countThisFn++;
  }
  console.log(`[OK] ${name}: ${countThisFn} entries (running total ${allEntries.length})`);
}

// Write metadata TS file.
function esc(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const tsLines = [];
tsLines.push("// Ported from legacy/index.html's virtual-lab seed functions (embedCuratedLabs,");
tsLines.push("// embedLessonXDemos, embedArchivePhysics20261027, embedEntertainmentGames20261027,");
tsLines.push("// etc. around index.html:9269-9485). Each entry's `html` field (when present)");
tsLines.push("// was extracted verbatim to public/lab-library/<id>.html — content unchanged.");
tsLines.push('export interface LabLibraryEntry {');
tsLines.push("  id: string;");
tsLines.push('  kind: "lab" | "game";');
tsLines.push("  subject: string;");
tsLines.push("  grade: string | number;");
tsLines.push("  lessonId?: string;");
tsLines.push("  title: string;");
tsLines.push("  description: string;");
tsLines.push("  sourceName?: string;");
tsLines.push("  /** false when the source entry had no bundled html (e.g. curriculum presets with empty content) — no file exists for these. */");
tsLines.push("  hasContent: boolean;");
tsLines.push("}");
tsLines.push("");
tsLines.push("export const LAB_LIBRARY: LabLibraryEntry[] = [");
for (const e of allEntries) {
  tsLines.push(
    `  { id: "${esc(e.id)}", kind: "${e.kind}", subject: "${esc(e.subject)}", grade: ${JSON.stringify(e.grade)}, ${
      e.lessonId ? `lessonId: "${esc(e.lessonId)}", ` : ""
    }title: "${esc(e.title)}", description: "${esc(e.description)}", ${
      e.sourceName ? `sourceName: "${esc(e.sourceName)}", ` : ""
    }hasContent: ${e.hasContent} },`,
  );
}
tsLines.push("];");

writeFileSync(META_OUT, tsLines.join("\n") + "\n", "utf-8");

console.log(`\nTOTAL entries: ${allEntries.length}`);
console.log(`TOTAL html files written: ${totalFiles}`);
console.log(`Entries with no content (empty html): ${allEntries.filter((e) => !e.hasContent).length}`);
console.log(`Failures: ${failures.length}`);
for (const f of failures) console.log(" - " + f);

const kindCounts = {};
const subjectCounts = {};
for (const e of allEntries) {
  kindCounts[e.kind] = (kindCounts[e.kind] || 0) + 1;
  subjectCounts[e.subject] = (subjectCounts[e.subject] || 0) + 1;
}
console.log("By kind:", kindCounts);
console.log("By subject:", subjectCounts);
