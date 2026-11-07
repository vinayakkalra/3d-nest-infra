import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

// Run the real browser source. External script insertion is recorded, never fetched.
const source = fs.readFileSync(new URL("analytics.js", import.meta.url), "utf8");
const consentKey = "3dnest_analytics_consent";
const disableKey = "ga-disable-G-CN3P0Q2FXM";

function createSharedStorage(initial = null) {
  const values = new Map(initial === null ? [] : [[consentKey, initial]]);
  const tabs = [];
  const pending = [];
  let mutations = 0;

  function announce(origin, key, oldValue, newValue) {
    for (const tab of tabs) {
      if (tab !== origin) {
        pending.push(() => tab.dispatchWindow("storage", {
          key, oldValue, newValue, storageArea: tab.storage,
        }));
      }
    }
  }

  function newTab(options = {}) {
    const windowListeners = new Map();
    const documentListeners = new Map();
    const scripts = [];
    const banners = [];
    const failures = { access: false, read: false, write: false, remove: false, ...options.failures };
    const addListener = (map, type, callback) => {
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(callback);
    };
    const dispatch = (map, type, event) => {
      for (const callback of map.get(type) || []) callback(event);
    };
    const tab = { failures, scripts, banners, reloads: 0 };
    tab.storage = {
      getItem(key) {
        if (failures.read) throw new Error("Storage read blocked");
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        if (failures.write) throw new Error("Storage write blocked");
        const oldValue = values.get(key) ?? null;
        value = String(value);
        if (oldValue === value) return;
        values.set(key, value);
        mutations++;
        announce(tab, key, oldValue, value);
      },
      removeItem(key) {
        if (failures.remove) throw new Error("Storage remove blocked");
        const oldValue = values.get(key) ?? null;
        if (oldValue === null) return;
        values.delete(key);
        mutations++;
        announce(tab, key, oldValue, null);
      },
      clear() {
        if (failures.remove) throw new Error("Storage clear blocked");
        if (!values.size) return;
        values.clear();
        mutations++;
        announce(tab, null, null, null);
      },
    };
    const document = {
      readyState: options.loading ? "loading" : "complete",
      head: { append: (element) => scripts.push(element) },
      body: { append: (element) => banners.push(element) },
      querySelector: () => banners.at(-1) || null,
      addEventListener: (type, callback) => addListener(documentListeners, type, callback),
      createElement(tagName) {
        const listeners = new Map();
        const controls = new Map();
        const element = {
          tagName,
          dataset: {},
          setAttribute() {},
          addEventListener: (type, callback) => addListener(listeners, type, callback),
          click: () => dispatch(listeners, "click", {}),
          querySelector(selector) {
            if (!controls.has(selector)) controls.set(selector, document.createElement("button"));
            return controls.get(selector);
          },
          remove() {
            const index = banners.indexOf(element);
            if (index >= 0) banners.splice(index, 1);
          },
        };
        return element;
      },
    };
    const window = {
      location: { pathname: "/privacy.html", reload: () => tab.reloads++ },
      addEventListener: (type, callback) => addListener(windowListeners, type, callback),
    };
    Object.defineProperty(window, "localStorage", {
      get() {
        if (failures.access) throw new Error("Storage access blocked");
        return tab.storage;
      },
    });
    tab.window = window;
    tab.document = document;
    tab.dispatchWindow = (type, event = {}) => dispatch(windowListeners, type, event);
    tab.ready = () => {
      document.readyState = "complete";
      dispatch(documentListeners, "DOMContentLoaded", {});
    };
    tab.choose = (choice) => {
      assert.ok(banners.length, "The visitor must have a visible consent choice");
      banners.at(-1).querySelector(`[data-consent-${choice}]`).click();
    };
    tab.reset = () => dispatch(documentListeners, "click", {
      target: { closest: (selector) => selector === "[data-reset-consent]" ? {} : null },
    });
    tab.track = () => window.track3DNestEvent("test_contact", { contact_method: "phone" });
    tab.events = () => window.dataLayer.filter((call) => call[0] === "event");
    tab.lastConsent = () => window.dataLayer.filter((call) => call[0] === "consent").at(-1)[2];
    tabs.push(tab);
    vm.runInNewContext(source, { window, document, Date, encodeURIComponent }, { filename: "analytics.js" });
    return tab;
  }

  return {
    newTab,
    values,
    get mutations() { return mutations; },
    flush() { while (pending.length) pending.shift()(); },
    dropEvents() { pending.length = 0; },
  };
}

function assertStopped(tab) {
  assert.equal(tab.window[disableKey], true, "Loaded GA must be disabled immediately");
  assert.equal(tab.lastConsent().analytics_storage, "denied");
  const events = tab.events().length;
  tab.track();
  assert.equal(tab.events().length, events, "No custom event may be queued after withdrawal");
  assert.equal(tab.reloads, 0, "Consent changes must not force a reload loop or discard a form");
}

test("default denial withholds the external tag and custom telemetry", () => {
  const tab = createSharedStorage().newTab();
  assert.equal(tab.scripts.length, 0);
  assert.equal(tab.banners.length, 1);
  assertStopped(tab);
});

test("explicit opt-in loads one tag; all advertising consent stays denied", () => {
  const shared = createSharedStorage();
  const tab = shared.newTab();
  tab.choose("accept");
  tab.track();
  assert.equal(shared.values.get(consentKey), "granted");
  assert.equal(tab.scripts.length, 1);
  assert.match(tab.scripts[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-CN3P0Q2FXM$/);
  assert.equal(tab.events().length, 1);
  assert.equal(tab.window[disableKey], false);
  for (const command of tab.window.dataLayer.filter((call) => call[0] === "consent")) {
    for (const name of ["ad_storage", "ad_user_data", "ad_personalization"]) {
      assert.equal(command[2][name], "denied");
    }
  }
});

test("shared grants do not activate an open page; fresh pages use saved consent without rewriting it", () => {
  const shared = createSharedStorage();
  const first = shared.newTab();
  const second = shared.newTab();
  first.choose("accept");
  shared.flush();
  second.track();
  assert.equal(second.scripts.length, 0);
  assert.equal(second.events().length, 0);
  const mutations = shared.mutations;
  const fresh = shared.newTab();
  assert.equal(fresh.scripts.length, 1);
  assert.equal(shared.mutations, mutations, "Reading a saved grant must not generate storage traffic");
});

test("a custom event cannot outrun another tab's decline before storage delivery", () => {
  const shared = createSharedStorage();
  const old = shared.newTab();
  const settings = shared.newTab();
  old.choose("accept");
  old.track();
  // The second tab still has its choice open: the first tab's grant event is
  // queued, so declining here is a real user action before storage delivery.
  settings.choose("decline");
  const before = old.events().length;
  old.track(); // No storage events have been delivered yet.
  assert.equal(old.events().length, before);
  assertStopped(old);
  shared.flush();
  assertStopped(old);
});

test("cross-tab reset and storage.clear disable a loaded tag and show a new choice", () => {
  for (const clear of [false, true]) {
    const shared = createSharedStorage("granted");
    const old = shared.newTab();
    const settings = shared.newTab();
    if (clear) settings.storage.clear();
    else settings.reset();
    shared.flush();
    assert.equal(old.banners.length, 1);
    assertStopped(old);
    assert.equal(old.scripts.length, 1);
  }
});

test("pageshow rechecks a restored page that missed the storage event", () => {
  const shared = createSharedStorage("granted");
  const restored = shared.newTab();
  const settings = shared.newTab();
  settings.reset();
  settings.choose("decline");
  shared.dropEvents();
  restored.dispatchWindow("pageshow", { persisted: true });
  assertStopped(restored);
  assert.equal(restored.banners.length, 0);
  settings.reset();
  settings.choose("accept");
  shared.dropEvents();
  restored.dispatchWindow("pageshow", { persisted: true });
  restored.track();
  assert.equal(restored.events().length, 0, "A restored page must not re-grant itself");
  assert.equal(restored.window[disableKey], true);
});

test("a delayed storage event cannot override a newer explicit choice on this page", () => {
  const shared = createSharedStorage("granted");
  const tab = shared.newTab();
  const settings = shared.newTab();
  settings.reset(); // Queues an older withdrawal for the first tab.
  tab.reset();
  tab.choose("accept"); // The current stored choice is now granted again.
  shared.flush();
  tab.track();
  assert.equal(tab.events().length, 1);
  assert.equal(tab.window[disableKey], false);
  assert.equal(tab.scripts.length, 1);
});

test("unrelated keys and session-storage events cannot change the page's consent", () => {
  const shared = createSharedStorage("granted");
  const tab = shared.newTab();
  tab.dispatchWindow("storage", { key: "theme", newValue: null, storageArea: tab.storage });
  tab.dispatchWindow("storage", { key: consentKey, newValue: "denied", storageArea: {} });
  tab.track();
  assert.equal(tab.events().length, 1);
  assert.equal(tab.window[disableKey], false);
});

test("blocked storage supports an explicit page-only grant, reset and decline", () => {
  const shared = createSharedStorage();
  const tab = shared.newTab({ failures: { access: true } });
  tab.choose("accept");
  tab.track();
  assert.equal(tab.events().length, 1);
  tab.reset();
  assertStopped(tab);
  assert.equal(tab.banners.length, 1);
  tab.choose("decline");
  tab.dispatchWindow("pageshow", { persisted: true });
  assertStopped(tab);
  assert.equal(tab.banners.length, 0);
});

test("a received withdrawal overrides a page-only grant even if storage access is blocked", () => {
  const shared = createSharedStorage();
  const old = shared.newTab({ failures: { access: true } });
  const settings = shared.newTab();
  old.choose("accept");
  old.track();
  assert.equal(old.events().length, 1);
  settings.choose("decline");
  shared.flush();
  assertStopped(old);
  assert.equal(old.banners.length, 0);

  old.reset();
  old.choose("accept");
  settings.reset();
  shared.flush();
  assertStopped(old);
  assert.equal(old.banners.length, 1);
});

test("a readable choice changed elsewhere overrides a page-only grant after a failed write", () => {
  const shared = createSharedStorage("denied");
  const tab = shared.newTab({ failures: { write: true, remove: true } });
  tab.reset();
  tab.choose("accept");
  tab.track();
  assert.equal(tab.events().length, 1);
  const other = shared.newTab();
  other.reset(); // Changes the old denied snapshot to no saved choice.
  const before = tab.events().length;
  tab.track();
  assert.equal(tab.events().length, before);
  assertStopped(tab); // Before asynchronous storage delivery.
});

test("failed removal cannot make reset re-grant the same page", () => {
  const shared = createSharedStorage("granted");
  const tab = shared.newTab({ failures: { remove: true } });
  tab.reset();
  assert.equal(shared.values.get(consentKey), "granted");
  assertStopped(tab);
  tab.dispatchWindow("pageshow", { persisted: true });
  assertStopped(tab);
  assert.equal(tab.banners.length, 1);
});

test("a saved grant fails closed if storage becomes unreadable without a page opt-in", () => {
  const shared = createSharedStorage("granted");
  const tab = shared.newTab();
  tab.failures.read = true;
  tab.track();
  assertStopped(tab);
  tab.failures.read = false;
  tab.dispatchWindow("pageshow", { persisted: true });
  assertStopped(tab);
});

test("storage recovery does not turn an unpersisted page grant into a shared grant", () => {
  const shared = createSharedStorage();
  const tab = shared.newTab({ failures: { access: true } });
  tab.choose("accept");
  tab.track();
  assert.equal(tab.events().length, 1);
  tab.failures.access = false;
  const before = tab.events().length;
  tab.track();
  assert.equal(tab.events().length, before);
  assertStopped(tab);
});

test("the DOM-ready banner honours a choice made in another tab while loading", () => {
  const shared = createSharedStorage();
  const loading = shared.newTab({ loading: true });
  const settings = shared.newTab();
  settings.choose("decline");
  shared.dropEvents();
  loading.ready();
  assert.equal(loading.banners.length, 0);
  assertStopped(loading);
});
