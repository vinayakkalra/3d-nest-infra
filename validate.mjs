import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const pages = fs.readdirSync(root).filter((file) => file.endsWith(".html"));
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

for (const file of pages) {
  const html = read(file);
  const h1Count = (html.match(/<h1\b/g) || []).length;
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1] || "";
  const description =
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/s)?.[1] || "";
  const canonical =
    html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/s)?.[1] || "";
  const openGraphUrl =
    html.match(/<meta\s+property="og:url"\s+content="([^"]*)"/s)?.[1] || "";

  if (h1Count !== 1) {
    errors.push(`${file}: expected one h1, found ${h1Count}`);
  }
  if (!title) {
    errors.push(`${file}: missing title`);
  }
  if (!description) {
    errors.push(`${file}: missing meta description`);
  }
  if (!canonical.startsWith("https://3dnestinfra.com/")) {
    errors.push(`${file}: missing or invalid canonical URL`);
  }
  if (openGraphUrl !== canonical) {
    errors.push(`${file}: og:url does not match canonical URL`);
  }

  const jsonLdBlocks = [
    ...html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ];

  for (const [index, match] of jsonLdBlocks.entries()) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      errors.push(`${file}: invalid JSON-LD block ${index + 1}: ${error.message}`);
    }
  }

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const rawUrl = match[1];
    if (/^(?:https?:|tel:|mailto:)/.test(rawUrl)) {
      continue;
    }

    const [filePart, fragment] = rawUrl.split("#");
    const targetFile = filePart || file;
    const targetPath = path.join(root, targetFile);

    if (!fs.existsSync(targetPath)) {
      errors.push(`${file}: missing local target ${rawUrl}`);
      continue;
    }

    if (fragment) {
      const targetHtml = fs.readFileSync(targetPath, "utf8");
      const escapedFragment = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const fragmentPattern = new RegExp(`id=["']${escapedFragment}["']`);
      if (!fragmentPattern.test(targetHtml)) {
        errors.push(`${file}: missing fragment target ${rawUrl}`);
      }
    }
  }

  console.log(
    `${file}: h1=${h1Count}, title=${title.length}, description=${description.length}, canonical=yes, jsonld=${jsonLdBlocks.length}`,
  );
}

for (const requiredFile of ["robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"]) {
  if (!fs.existsSync(path.join(root, requiredFile))) {
    errors.push(`missing discovery file: ${requiredFile}`);
  }
}

if (errors.length) {
  console.error("\nValidation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`\nValidated ${pages.length} HTML pages and all local links.`);
