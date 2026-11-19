import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prepareSubmission, submitPrepared } from "./indexnow.mjs";

const origin = "https://3dnestinfra.com";
const key = "0123456789abcdef0123456789abcdef";
const html = "<!doctype html><h1>Buyer checklist</h1>";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "3dnest-indexnow-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "sitemap.xml"), `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/buyer.html</loc></url></urlset>`);
  await fs.writeFile(path.join(root, "indexnow-key.txt"), `${key}\n`);
  await fs.writeFile(path.join(root, "index.html"), html);
  await fs.writeFile(path.join(root, "buyer.html"), html);
  return root;
}

function mock({ keyBody = key, keyStatus = 200, pageBody = html, pageStatus = 200, postStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "POST") return new Response(null, { status: postStatus });
    if (url.endsWith("/indexnow-key.txt")) return new Response(keyBody, { status: keyStatus });
    return new Response(pageBody, { status: pageStatus });
  };
  return { calls, fetchImpl };
}

test("only canonical sitemap URLs can be selected; duplicate selections collapse", async (t) => {
  const root = await fixture(t);
  const plan = await prepareSubmission(["/", "buyer.html", `${origin}/buyer.html`], root);
  assert.deepEqual(plan.payload.urlList, [`${origin}/`, `${origin}/buyer.html`]);
  for (const input of ["https://example.com/buyer.html", "//example.com/buyer.html", `${origin}/buyer.html?phone=123`, `${origin}/buyer.html#notes`, "not-listed.html", `${origin}/../private.txt`]) {
    await assert.rejects(prepareSubmission([input], root));
  }
  await assert.rejects(prepareSubmission([], root));
});

test("a missing or malformed local key fails before any network action", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "indexnow-key.txt"), "not-a-valid-key");
  await assert.rejects(prepareSubmission(["buyer.html"], root));
  await fs.rm(path.join(root, "indexnow-key.txt"));
  await assert.rejects(prepareSubmission(["buyer.html"], root));
});

test("a key mismatch, missing key, old page or failed page never triggers a POST", async (t) => {
  const plan = await prepareSubmission(["buyer.html"], await fixture(t));
  for (const settings of [{ keyBody: "wrong" }, { keyStatus: 404 }, { pageBody: "older deployed content" }, { pageStatus: 404 }]) {
    const network = mock(settings);
    await assert.rejects(submitPrepared(plan, network));
    assert.equal(network.calls.filter((call) => call.options.method === "POST").length, 0);
  }
});

test("one notification follows verified bytes; 200 and 202 keep receipt distinct from indexing", async (t) => {
  const plan = await prepareSubmission(["/", "buyer.html"], await fixture(t));
  for (const status of [200, 202]) {
    const network = mock({ postStatus: status });
    const receipt = await submitPrepared(plan, network);
    const posts = network.calls.filter((call) => call.options.method === "POST");
    assert.equal(posts.length, 1);
    assert.equal(posts[0].url, "https://api.indexnow.org/indexnow");
    assert.deepEqual(JSON.parse(posts[0].options.body), plan.payload);
    assert.ok(network.calls.every((call) => call.options.redirect === "error"));
    assert.equal(receipt.status, status === 200 ? "received" : "received_key_validation_pending");
    assert.equal(receipt.indexed, undefined);
  }
});

test("rate limits are surfaced without retries", async (t) => {
  const plan = await prepareSubmission(["buyer.html"], await fixture(t));
  const network = mock({ postStatus: 429 });
  await assert.rejects(submitPrepared(plan, network), /HTTP 429/);
  assert.equal(network.calls.filter((call) => call.options.method === "POST").length, 1);
});

test("default CLI mode is a preview and does not print the verification value", () => {
  const output = execFileSync(process.execPath, [new URL("./indexnow.mjs", import.meta.url).pathname, "home-buying-mohali.html"], { encoding: "utf8" });
  const preview = JSON.parse(output);
  assert.equal(preview.status, "dry_run");
  assert.equal(preview.networkRequests, 0);
  assert.equal(preview.key, undefined);
});
