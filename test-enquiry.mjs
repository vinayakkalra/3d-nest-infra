import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Static safety contract plus actual script.js initialization/submit handlers.
// No browser is opened and every outbound route is captured locally.
const html = fs.readFileSync(new URL("index.html", import.meta.url), "utf8");
const source = fs.readFileSync(new URL("script.js", import.meta.url), "utf8");
const formHtml = html.match(/<form\b[^>]*data-lead-form[^>]*>([\s\S]*?)<\/form>/)?.[1];
assert.ok(formHtml, "Homepage enquiry form exists");
const group = formHtml.match(/<fieldset\b([^>]*data-lead-form-fields[^>]*)>([\s\S]*?)<\/fieldset>/);
assert.ok(group && /\bdisabled(?:\s|$)/.test(group[1]), "HTML starts with a disabled fieldset");
const named = (text) => [...text.matchAll(/\bname="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(named(formHtml), named(group[2]), "Every named field is inside the disabled group");
assert.match(group[2], /<button\b[^>]*type="submit"/, "Submit is inside the disabled group");
const fallbackHtml = formHtml.slice(0, group.index);
assert.match(fallbackHtml, /data-enquiry-fallback/, "Fallback is outside the disabled group");
assert.match(fallbackHtml, /href="https:\/\/wa\.me\/916283089690\?text=/);
assert.doesNotMatch(html.split("</head>")[0], /classList\.add\("js"\)/, "No head flag hides content before setup");
assert.doesNotMatch(html, /class="(?:lead-form|enquiry-copy)[^"]*\breveal\b/);

function classList() {
  const values = new Set();
  return {
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    contains: (value) => values.has(value),
    toggle(value, force) {
      const on = force ?? !values.has(value);
      if (on) values.add(value); else values.delete(value);
      return on;
    },
  };
}

function fixture({ search = "", failAt = "", run = true } = {}) {
  const events = new Map(), opened = [], analytics = [], inputEvents = new Map();
  let focused = null, disabled = true, hidden = false;
  const fields = {};
  for (const match of group[2].matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const name = match[2].match(/\bname="([^"]+)"/)?.[1];
    if (!name) continue;
    const attributes = new Map();
    fields[name] = {
      name, value: "", checked: false,
      type: match[2].match(/\btype="([^"]+)"/)?.[1] || (match[1] === "select" ? "select-one" : "text"),
      disabled: /\bdisabled(?:\s|$)/.test(match[2]),
      required: /\brequired(?:\s|$)/.test(match[2]),
      classList: classList(),
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: (key) => attributes.delete(key),
      focus: () => { focused = name; },
      addEventListener: (type, fn) => inputEvents.set(`${name}:${type}`, fn),
    };
  }
  const leadFields = {
    get disabled() { return disabled; },
    set disabled(value) {
      if (!value) assert.ok(events.has("submit"), "Submit interception must exist before enabling");
      disabled = value;
    },
  };
  const fallback = {
    get hidden() { return hidden; },
    set hidden(value) {
      if (value) assert.ok(events.has("submit") && !disabled, "Hide fallback only after ready");
      hidden = value;
    },
  };
  const budgetWrapper = { hidden: true };
  const leadForm = {
    elements: { namedItem: (name) => fields[name] },
    querySelector: (selector) => ({
      "[data-lead-form-fields]": leadFields,
      "[data-enquiry-fallback]": fallback,
      "[data-purchase-budget]": budgetWrapper,
    })[selector],
    querySelectorAll: () => Object.values(fields).filter((field) => field.required),
    addEventListener: (type, fn) => events.set(type, fn),
  };
  const menuAttributes = new Map([["aria-expanded", "false"]]);
  const generic = () => ({ classList: classList(), addEventListener() {} });
  const menu = { ...generic(), querySelectorAll: () => [] };
  const menuToggle = { ...generic(), setAttribute: (key, value) => menuAttributes.set(key, value), getAttribute: (key) => menuAttributes.get(key) };
  const status = { textContent: "" };
  const year = { set textContent(value) { if (failAt === "late") throw Error("Injected late setup failure"); } };
  const selectors = {
    "[data-header]": generic(), "[data-menu-toggle]": menuToggle,
    "[data-mobile-menu]": menu, "[data-lead-form]": leadForm,
    "[data-form-status]": status, "[data-year]": year,
    ".mobile-contact": generic(), ".hero": { offsetHeight: 790 },
    "#enquiry": { getBoundingClientRect: () => ({ top: 1000, bottom: 1800 }) },
  };
  const rootClasses = classList();
  const document = {
    querySelector: (selector) => selectors[selector], querySelectorAll: () => [],
    addEventListener() {}, body: { classList: classList() },
    documentElement: { classList: rootClasses },
  };
  class FormDataFixture {
    constructor() {
      this.values = new Map();
      if (leadFields.disabled) return;
      for (const field of Object.values(fields)) {
        if (!field.disabled && (field.type !== "checkbox" || field.checked)) this.values.set(field.name, field.value);
      }
    }
    get(name) { return this.values.get(name) ?? null; }
  }
  const window = {
    location: { search }, scrollY: 0, innerHeight: 800, innerWidth: 1200,
    addEventListener(type) { if (failAt === "early" && type === "resize") throw Error("Injected early setup failure"); },
    open: (...args) => opened.push(args),
    track3DNestEvent: (...args) => analytics.push(args),
  };
  let error;
  if (run) {
    try { vm.runInNewContext(source, { document, window, URLSearchParams, FormData: FormDataFixture }); }
    catch (caught) { error = caught; }
  }
  const submit = () => {
    let prevented = false;
    events.get("submit")?.({ preventDefault: () => { prevented = true; } });
    return prevented;
  };
  const fill = () => {
    Object.assign(fields.name, { value: "Local QA / ਮੋਹਾਲੀ" });
    fields.company.value = "Local test only";
    fields.phone.value = "+44 0000 000000";
    fields.market.value = "Mohali";
    fields.timeline.value = "Exploring options";
    fields.details.value = "Light, privacy & access\nਪੰਜਾਬੀ / हिन्दी <literal>";
    fields.consent.checked = true;
  };
  return { leadFields, fallback, fields, budgetWrapper, opened, analytics, events, inputEvents, status, rootClasses, error, submit, fill, successfulFields: () => new FormDataFixture().values, focused: () => focused };
}

const noScript = fixture({ run: false });
assert.equal(noScript.leadFields.disabled, true); assert.equal(noScript.fallback.hidden, false);
assert.equal(noScript.successfulFields().size, 0, "No named controls available for a native GET fallback");
for (const failAt of ["early", "late"]) {
  const broken = fixture({ failAt });
  assert.ok(broken.error); assert.equal(broken.leadFields.disabled, true); assert.equal(broken.fallback.hidden, false);
  assert.equal(broken.successfulFields().size, 0); assert.equal(broken.rootClasses.contains("js"), false);
  broken.fill(); broken.submit(); assert.equal(broken.opened.length, 0); assert.equal(broken.analytics.length, 0);
}
const home = fixture({ search: "?requirement=home-purchase" });
assert.equal(home.error, undefined); assert.equal(home.leadFields.disabled, false); assert.equal(home.fallback.hidden, true);
assert.equal(home.fields.requirement.value, "Home purchase"); assert.equal(home.fields.purchaseBudget.disabled, false);
assert.equal(home.submit(), true); assert.equal(home.opened.length, 0); assert.equal(home.focused(), "name");
home.fill(); home.fields.purchaseBudget.value = "₹1 crore / still exploring";
assert.equal(home.submit(), true); assert.equal(home.opened.length, 1);
const target = new URL(home.opened[0][0]), message = target.searchParams.get("text");
assert.equal(target.hostname, "wa.me"); assert.equal(target.pathname, "/916283089690");
assert.ok(message.includes(home.fields.name.value)); assert.ok(message.includes(home.fields.details.value));
assert.ok(message.includes("Buying budget: ₹1 crore / still exploring"));
assert.deepEqual(Object.keys(home.analytics[0][1]).sort(), ["method", "preferred_market", "requirement_type"]);
assert.ok(!JSON.stringify(home.analytics).includes(home.fields.name.value));
const rental = fixture({ search: "?requirement=corporate-housing" });
rental.fill(); rental.fields.purchaseBudget.value = "Stale buying budget";
assert.equal(rental.fields.requirement.value, "Corporate housing"); assert.equal(rental.fields.purchaseBudget.disabled, true);
rental.submit(); assert.ok(!new URL(rental.opened[0][0]).searchParams.get("text").includes("Buying budget:"));
const optional = fixture({ search: "?requirement=home-purchase" }); optional.fill(); optional.submit();
assert.ok(!new URL(optional.opened[0][0]).searchParams.get("text").includes("Buying budget:"));
console.log("Enquiry checks passed: initially disabled HTML contract, early/late failure stays closed, ready-only enable, validation, service preselection, optional budget and Unicode WhatsApp draft. No outbound message sent.");
