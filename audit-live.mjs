import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Read-only deployment check against the public site. No enquiry is submitted.
const root = path.dirname(fileURLToPath(import.meta.url));
const origin = "https://3dnestinfra.com/";
const htmlFiles = (await fs.readdir(root)).filter((file) => file.endsWith(".html"));
const files = [
  ...htmlFiles,
  "styles.css",
  "script.js",
  "analytics.js",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "llms-full.txt",
  "assets/karan-kalra-founder.jpg",
  "assets/home-buying-brief.txt",
  "comparison.js",
  "comparison.css",
  "assets/property-comparison-worksheet.txt",
];
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const results = [];

// Limit concurrent public requests rather than retrying failed URLs in a burst.
let nextFile = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (nextFile < files.length) {
      const file = files[nextFile++];
      const url = new URL(file === "index.html" ? "" : file, origin).href;
      try {
        const local = await fs.readFile(path.join(root, file));
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { "Cache-Control": "no-cache" },
        });
        const remote = Buffer.from(await response.arrayBuffer());
        const matches = response.ok && hash(local) === hash(remote);
        results.push({ file, url, status: response.status, matches });
      } catch (error) {
        results.push({ file, url, matches: false, error: error.message });
      }
    }
  }),
);
results.sort((a, b) => a.file.localeCompare(b.file));
const report = {
  checkedAt: new Date().toISOString(),
  origin,
  complete: results.every((result) => result.matches),
  matchingFiles: results.filter((result) => result.matches).length,
  totalFiles: results.length,
  results,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const result of results) {
    console.log(
      `${result.matches ? "MATCH" : "PENDING"} ${result.file} (${result.status ?? result.error})`,
    );
  }
  console.log(`\n${report.matchingFiles}/${report.totalFiles} public files match this checkout.`);
  console.log("This checks deployment, not indexing, rankings or Analytics delivery.");
}
process.exitCode = report.complete ? 0 : 1;
