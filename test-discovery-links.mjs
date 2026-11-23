import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(new URL("discovery-links.js", import.meta.url), "utf8");
const observed = "https://3dnestinfra.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=property_services%23enquiry&utm_content=link_in_bio";

function visit(href, { readyState = "complete", sectionPresent = true, historyBlocked = false } = {}) {
  const state = { existing: "state" };
  const replacements = [], scrolls = [], listeners = [];
  const location = { href };
  const document = {
    readyState,
    getElementById: (id) => id === "enquiry" && sectionPresent
      ? { scrollIntoView: (options) => scrolls.push(options) } : null,
    addEventListener: (name, callback, options) => listeners.push({ name, callback, options }),
  };
  const history = {
    state,
    replaceState(nextState, title, nextURL) {
      if (historyBlocked) throw new Error("History is unavailable");
      replacements.push({ state: nextState, title, url: nextURL });
      location.href = new URL(nextURL, location.href).href;
    },
  };
  vm.runInNewContext(source, { URL, window: { location, history }, document });
  return { location, state, replacements, scrolls, listeners };
}

test("the observed bio link restores enquiry routing and campaign attribution", () => {
  const result = visit(`${observed}&fbclid=test-click&requirement=commercial-lease`);
  const url = new URL(result.location.href);
  assert.equal(url.hash, "#enquiry");
  assert.equal(url.searchParams.get("utm_campaign"), "property_services");
  assert.equal(url.searchParams.get("utm_source"), "instagram");
  assert.equal(url.searchParams.get("utm_medium"), "organic_social");
  assert.equal(url.searchParams.get("utm_content"), "link_in_bio");
  assert.equal(url.searchParams.get("fbclid"), "test-click");
  assert.equal(url.searchParams.get("requirement"), "commercial-lease");
  assert.equal(result.replacements.length, 1);
  assert.equal(result.replacements[0].state, result.state);
  assert.equal(result.scrolls.length, 1);
  assert.equal(result.scrolls[0].behavior, "instant");
});

test("index.html has the same recovery without changing its path", () => {
  const result = visit(observed.replace("/?", "/index.html?"));
  assert.equal(new URL(result.location.href).pathname, "/index.html");
  assert.equal(new URL(result.location.href).hash, "#enquiry");
});

for (const [label, href] of [
  ["a correctly formed enquiry link", observed.replace("%23enquiry", "") + "#enquiry"],
  ["a different campaign", observed.replace("property_services", "another_campaign")],
  ["a different source", observed.replace("utm_source=instagram", "utm_source=google")],
  ["a different medium", observed.replace("organic_social", "paid_social")],
  ["a different page", observed.replace("/?", "/home-buying-mohali.html?")],
  ["an explicit different fragment", observed + "#services"],
  ["an ordinary homepage visit", "https://3dnestinfra.com/"],
]) {
  test(`${label} is left unchanged`, () => {
    const result = visit(href);
    assert.equal(result.location.href, href);
    assert.equal(result.replacements.length, 0);
    assert.equal(result.scrolls.length, 0);
    assert.equal(result.listeners.length, 0);
  });
}

test("routing waits for the document when needed", () => {
  const result = visit(observed, { readyState: "loading" });
  assert.equal(new URL(result.location.href).hash, "#enquiry");
  assert.equal(result.scrolls.length, 0);
  assert.equal(result.listeners.length, 1);
  assert.equal(result.listeners[0].name, "DOMContentLoaded");
  assert.equal(result.listeners[0].options.once, true);
  result.listeners[0].callback();
  assert.equal(result.scrolls.length, 1);
});

test("a missing section or blocked History API does not break other scripts", () => {
  assert.doesNotThrow(() => visit(observed, { sectionPresent: false }));
  const result = visit(observed, { historyBlocked: true });
  assert.equal(result.location.href, observed);
  assert.equal(result.scrolls.length, 0);
});

test("homepage recovery runs before Analytics and the enquiry builder", () => {
  const html = fs.readFileSync(new URL("index.html", import.meta.url), "utf8");
  const recovery = html.indexOf('<script src="discovery-links.js?');
  assert.ok(recovery > 0);
  assert.ok(recovery < html.indexOf('<script src="analytics.js?'));
  assert.ok(recovery < html.indexOf('<script src="script.js?'));
});
