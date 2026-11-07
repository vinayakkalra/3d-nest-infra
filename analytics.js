const GA_MEASUREMENT_ID = "G-CN3P0Q2FXM";
const CONSENT_KEY = "3dnest_analytics_consent";
const analyticsConfigured =
  /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID) &&
  GA_MEASUREMENT_ID !== "G-REPLACE_WITH_ID";

if (analyticsConfigured) {
  const googleAnalyticsDisableKey = `ga-disable-${GA_MEASUREMENT_ID}`;
  // Set this before any gtag calls; a loaded tag must also stop on withdrawal.
  window[googleAnalyticsDisableKey] = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });

  let analyticsGranted = false;
  let googleTagLoaded = false;
  let appliedConsent = "denied";
  let pageChoice;
  let unpersistedChoiceSnapshot = null;

  function readConsent() {
    try {
      return { available: true, value: window.localStorage.getItem(CONSENT_KEY) };
    } catch {
      return { available: false, value: null };
    }
  }

  function saveConsent(value) {
    pageChoice = value;
    try {
      if (value === null) {
        window.localStorage.removeItem(CONSENT_KEY);
      } else {
        window.localStorage.setItem(CONSENT_KEY, value);
      }
      unpersistedChoiceSnapshot = null;
    } catch {
      // The choice applies to the current page even if storage is unavailable.
      unpersistedChoiceSnapshot = readConsent();
    }
  }

  function currentConsent() {
    const saved = readConsent();
    if (!saved.available) {
      return pageChoice;
    }

    // A failed write can leave an older readable choice behind. Honour the
    // explicit page choice only while that snapshot remains unchanged.
    if (
      unpersistedChoiceSnapshot?.available &&
      saved.value === unpersistedChoiceSnapshot.value
    ) {
      return pageChoice;
    }
    unpersistedChoiceSnapshot = null;
    return saved.value;
  }

  function updateGoogleConsent(value) {
    if (appliedConsent === value) {
      return;
    }
    appliedConsent = value;
    window.gtag("consent", "update", {
      analytics_storage: value,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }

  function loadGoogleTag() {
    if (googleTagLoaded) {
      return;
    }

    googleTagLoaded = true;
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      GA_MEASUREMENT_ID,
    )}`;
    document.head.append(tag);

    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      anonymize_ip: true,
      send_page_view: true,
    });
  }

  function grantAnalytics(persist = true) {
    if (persist) {
      saveConsent("granted");
    }
    analyticsGranted = true;
    window[googleAnalyticsDisableKey] = false;
    updateGoogleConsent("granted");
    loadGoogleTag();
  }

  function stopAnalytics() {
    analyticsGranted = false;
    window[googleAnalyticsDisableKey] = true;
    updateGoogleConsent("denied");
  }

  function denyAnalytics() {
    saveConsent("denied");
    stopAnalytics();
  }

  function removeConsentBanner() {
    document.querySelector("[data-consent-banner]")?.remove();
  }

  function showConsentBanner() {
    if (document.querySelector("[data-consent-banner]")) {
      return;
    }

    const banner = document.createElement("section");
    banner.className = "consent-banner";
    banner.dataset.consentBanner = "";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Analytics preference");
    banner.innerHTML = `
      <div>
        <strong>Optional website analytics</strong>
        <p>
          Allow anonymous usage measurement to help 3D Nest Infra improve this website.
          Advertising cookies are not used. <a href="privacy.html">Privacy details</a>
        </p>
      </div>
      <div class="consent-actions">
        <button type="button" data-consent-decline>Decline</button>
        <button type="button" class="consent-accept" data-consent-accept>Allow analytics</button>
      </div>
    `;

    banner.querySelector("[data-consent-accept]").addEventListener("click", () => {
      grantAnalytics();
      removeConsentBanner();
    });
    banner.querySelector("[data-consent-decline]").addEventListener("click", () => {
      denyAnalytics();
      removeConsentBanner();
    });
    document.body.append(banner);
  }

  function reconcileConsent(choice = currentConsent()) {
    if (choice !== "granted") {
      stopAnalytics();
    }
    if (choice === "granted" || choice === "denied") {
      removeConsentBanner();
    } else if (document.readyState !== "loading") {
      showConsentBanner();
    }
    // A grant in another tab does not start collection in this open page.
  }

  window.track3DNestEvent = function track3DNestEvent(eventName, parameters = {}) {
    const choice = currentConsent();
    // Storage events are asynchronous. Check the shared choice before every
    // custom event so an older tab cannot outrun a reset or decline elsewhere.
    if (!analyticsGranted || choice !== "granted") {
      reconcileConsent(choice);
      return;
    }

    window.gtag("event", eventName, parameters);
  };

  window.addEventListener("storage", (event) => {
    if (event.key !== CONSENT_KEY && event.key !== null) {
      return;
    }
    try {
      if (event.storageArea !== window.localStorage) {
        return;
      }
    } catch {
      // Still honour a received withdrawal if storage access became blocked.
    }
    if (event.newValue !== "granted") {
      pageChoice = event.newValue === "denied" ? "denied" : null;
      unpersistedChoiceSnapshot = null;
    }
    // A queued event may predate a newer explicit choice. Read current storage
    // when possible; the received negative choice is the blocked-storage fallback.
    reconcileConsent();
  });
  window.addEventListener("pageshow", () => reconcileConsent());

  if (currentConsent() === "granted") {
    grantAnalytics(false);
  }
  reconcileConsent();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => reconcileConsent(), { once: true });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) {
      return;
    }

    const href = link.getAttribute("href") || "";
    let contactMethod = "";

    if (href.startsWith("tel:")) {
      contactMethod = "phone";
    } else if (href.startsWith("mailto:")) {
      contactMethod = "email";
    } else if (href.includes("wa.me/")) {
      contactMethod = "whatsapp";
    }

    if (contactMethod) {
      window.track3DNestEvent("contact_click", {
        contact_method: contactMethod,
        page_path: window.location.pathname,
      });
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-reset-consent]")) {
      return;
    }

    saveConsent(null);
    stopAnalytics();
    reconcileConsent();
  });
}
