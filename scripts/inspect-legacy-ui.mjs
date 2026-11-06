import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const legacyPath = path.resolve("legacy/index.html");
const outDir = path.resolve("scripts/ui-inspect-out");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("file://" + legacyPath, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(1500);

// Full dashboard screenshot
await page.screenshot({ path: path.join(outDir, "dashboard-full.png") });

// Sidebar closeup
const sidebar = await page.$(".sidebar");
if (sidebar) await sidebar.screenshot({ path: path.join(outDir, "sidebar.png") });

// Studio topbar + hero closeup
const main = await page.$(".main");
if (main) await main.screenshot({ path: path.join(outDir, "main.png") });

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

const basicProps = ["background-color", "background-image", "color", "border-color", "border-radius", "box-shadow", "font-family", "font-size", "font-weight", "padding", "width"];

const report = {};
report.body = await cs("body", ["background-color", "background-image", "color", "font-family"]);
report.sidebar = await cs(".sidebar", basicProps);
report.proBrand = await cs(".pro-brand", basicProps);
report.proBrandName = await cs(".pro-brand-name", basicProps);
report.navButton = await cs(".nav button", basicProps);
report.navButtonActive = await cs(".nav button.active", basicProps);
report.studioTopbar = await cs(".studio-topbar", basicProps);
report.studioHero = await cs(".studio-hero", basicProps);
report.studioHeroH1 = await cs(".studio-hero h1", basicProps);
report.studioToolCard = await cs(".studio-tool-card", basicProps);
report.studioKpi = await cs(".studio-kpi", basicProps);
report.btnBlue = await cs(".btn-blue", basicProps);
report.card = await cs(".card", basicProps);

fs.writeFileSync(path.join(outDir, "computed-styles.json"), JSON.stringify(report, null, 2));

// Also dump the actual rendered text/structure of the dashboard page for copy accuracy
const dashboardHtml = await page.evaluate(() => {
  const el = document.querySelector("#page-dashboard");
  return el ? el.outerHTML : null;
});
if (dashboardHtml) {
  fs.writeFileSync(path.join(outDir, "dashboard-section.html"), dashboardHtml);
}

console.log("Done. Output in", outDir);
await browser.close();
