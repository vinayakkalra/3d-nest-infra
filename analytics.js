const GA_MEASUREMENT_ID = "G-REPLACE_WITH_ID";
const CONSENT_KEY = "3dnest_analytics_consent";
const analyticsConfigured =
  /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID) &&
  GA_MEASUREMENT_ID !== "G-REPLACE_WITH_ID";

if (analyticsConfigured) {
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

  function readConsent() {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch {
      return null;
    }
  }

  function saveConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // The choice applies to the current page even if storage is unavailable.
    }
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

  function grantAnalytics() {
    analyticsGranted = true;
    saveConsent("granted");
    window.gtag("consent", "update", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    loadGoogleTag();
  }

  function denyAnalytics() {
    analyticsGranted = false;
    saveConsent("denied");
    window.gtag("consent", "update", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
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

  window.track3DNestEvent = function track3DNestEvent(eventName, parameters = {}) {
    if (!analyticsGranted) {
      return;
    }

    window.gtag("event", eventName, parameters);
  };

  const savedConsent = readConsent();
  if (savedConsent === "granted") {
    grantAnalytics();
  } else if (savedConsent === "denied") {
    denyAnalytics();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showConsentBanner, { once: true });
  } else {
    showConsentBanner();
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

    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch {
      // Reloading still gives the visitor another choice for this page.
    }
    window.location.reload();
  });
}
