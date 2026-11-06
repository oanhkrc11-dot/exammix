import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const legacyPath = path.resolve("legacy/index.html");
const outDir = path.resolve("scripts/ui-inspect-out");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("file://" + legacyPath, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(1000);

function cs(selector, props) {
  return page.evaluate(
    ({ selector, props }) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const s = getComputedStyle(el);
      const out = {};
      for (const p of props) out[p] = s.getPropertyValue(p);
      return out;
    },
    { selector, props },
  );
}

const basicProps = ["background-color", "background-image", "color", "border-color", "border-radius", "box-shadow", "font-size", "font-weight", "padding"];

const report = {};
report.studioSecondary = await cs(".studio-secondary", basicProps);
report.studioPrimary = await cs(".studio-primary", basicProps);
report.studioToolIcon = await cs(".studio-tool-icon", basicProps);
report.studioFlowStep = await cs(".studio-flow-step", basicProps);
report.studioFlowNum = await cs(".studio-flow-num", basicProps);
report.studioEyebrow = await cs(".studio-eyebrow", basicProps);
report.studioEyebrowI = await cs(".studio-eyebrow i", basicProps);
report.proBrandIcon = await cs(".pro-brand-icon", basicProps);
report.licensePanel = await cs(".license-panel", basicProps);
report.navSpanTron = await cs('[data-page="tron"] span', basicProps);
report.navSpanHvtt = await cs('[data-page="hocvientrithuc"] span', basicProps);
report.navSpanLive = await cs('[data-page="lophoctuongtac"] span', basicProps);
report.navSpanLab = await cs('[data-page="phongthinghiem"] span', basicProps);
report.navSpanGemini = await cs('[data-page="tienich"] span', basicProps);
report.navSpanGame = await cs('[data-page="gamecenter"] span', basicProps);
report.navSpanHome = await cs('[data-page="dashboard"] span', basicProps);

fs.writeFileSync(path.join(outDir, "computed-styles-2.json"), JSON.stringify(report, null, 2));

// Extract the actual logo image src (base64) to a file
const logoSrc = await page.evaluate(() => document.querySelector(".pro-brand-icon img")?.getAttribute("src") || null);
if (logoSrc && logoSrc.startsWith("data:image/png;base64,")) {
  const base64 = logoSrc.replace("data:image/png;base64,", "");
  fs.writeFileSync(path.join(outDir, "logo.png"), Buffer.from(base64, "base64"));
  console.log("Logo saved, bytes:", base64.length);
} else {
  console.log("Logo src not found or not png:", String(logoSrc).slice(0, 50));
}

// Also screenshot a non-active nav button area closeup + the tool card icons for color reference
await page.screenshot({ path: path.join(outDir, "full-page-2.png"), fullPage: false });

console.log("Done.");
await browser.close();
