(() => {
  // Recover the observed Instagram bio URL before Analytics reads its campaign.
  // Leave other campaigns, pages and explicit fragments unchanged.
  let url;
  try {
    url = new URL(window.location.href);
  } catch {
    return;
  }

  if (
    !["/", "/index.html"].includes(url.pathname) ||
    url.hash ||
    url.searchParams.get("utm_source") !== "instagram" ||
    url.searchParams.get("utm_medium") !== "organic_social" ||
    url.searchParams.get("utm_campaign") !== "property_services#enquiry"
  ) {
    return;
  }

  url.searchParams.set("utm_campaign", "property_services");
  url.hash = "enquiry";
  try {
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // A blocked History API must not interrupt the form or consent controls.
    return;
  }

  const showEnquiry = () => {
    // Initial landing should not animate through the entire mobile homepage.
    document.getElementById("enquiry")?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showEnquiry, { once: true });
  } else {
    showEnquiry();
  }
})();
