import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const origin = "https://3dnestinfra.com";
const endpoint = "https://api.indexnow.org/indexnow";
const keyFile = "indexnow-key.txt";
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// Select only public, canonical sitemap pages. Never send enquiry parameters.
export async function prepareSubmission(requested, directory = root) {
  if (!requested.length) throw new Error("Select at least one updated page.");
  const sitemap = await fs.readFile(path.join(directory, "sitemap.xml"), "utf8");
  const known = new Set([...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]));
  const urls = [...new Set(requested.map((input) => {
    const url = new URL(input, `${origin}/`);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash || !known.has(url.href)) {
      throw new Error("Use only canonical 3dnestinfra.com sitemap pages, without queries or fragments.");
    }
    return url.href;
  }))];
  const key = (await fs.readFile(path.join(directory, keyFile), "utf8")).trim();
  if (!/^[a-f0-9]{32}$/.test(key)) throw new Error("Invalid public IndexNow verification file.");
  const pages = await Promise.all(urls.map(async (url) => {
    const pathname = new URL(url).pathname;
    const file = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
    if (!file.endsWith(".html")) throw new Error("Only public HTML pages are supported.");
    const local = await fs.readFile(path.join(directory, file));
    return { url, sha256: hash(local) };
  }));
  return { payload: { host: new URL(origin).host, key, keyLocation: `${origin}/${keyFile}`, urlList: urls }, pages };
}

// No notification is sent until the public key and every selected page match.
export async function submitPrepared(plan, { fetchImpl = fetch } = {}) {
  const options = () => ({ redirect: "error", signal: AbortSignal.timeout(15000), headers: { "Cache-Control": "no-cache" } });
  const keyResponse = await fetchImpl(plan.payload.keyLocation, options());
  if (keyResponse.status !== 200 || (await keyResponse.text()).trim() !== plan.payload.key) {
    throw new Error("The public verification file is not deployed yet; no URLs submitted.");
  }
  for (const page of plan.pages) {
    const response = await fetchImpl(page.url, options());
    if (response.status !== 200 || hash(Buffer.from(await response.arrayBuffer())) !== page.sha256) {
      throw new Error(`The live page does not match this checkout: ${page.url}; no URLs submitted.`);
    }
  }
  const response = await fetchImpl(endpoint, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(plan.payload),
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow returned HTTP ${response.status}. No automatic retry was made.`);
  }
  return {
    checkedAt: new Date().toISOString(), endpoint, httpStatus: response.status,
    status: response.status === 200 ? "received" : "received_key_validation_pending",
    urls: plan.payload.urlList,
    note: "Receipt is not proof of crawling, indexing, ranking or AI citations. Participating engines share the notification; this is not a Google recrawl request.",
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.includes("--help")) {
      console.log("Preview: node indexnow.mjs <updated canonical URLs or page paths>\nSubmit after deployment: node indexnow.mjs --submit <same updated pages>\nPreview makes no network requests. Submission verifies the live key and exact page bytes first.");
    } else {
      const submit = args.includes("--submit");
      if (args.some((arg) => arg.startsWith("--") && arg !== "--submit")) throw new Error("Unknown option; use --help.");
      const plan = await prepareSubmission(args.filter((arg) => arg !== "--submit"));
      console.log(JSON.stringify(submit ? await submitPrepared(plan) : {
        status: "dry_run", urls: plan.payload.urlList, keyLocation: plan.payload.keyLocation,
        networkRequests: 0, note: "No notification sent. Re-run with --submit only after deployment.",
      }, null, 2));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
