const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileMenu = document.querySelector("[data-mobile-menu]");
const leadForm = document.querySelector("[data-lead-form]");
const leadFields = leadForm.querySelector("[data-lead-form-fields]");
const enquiryFallback = leadForm.querySelector("[data-enquiry-fallback]");
const formStatus = document.querySelector("[data-form-status]");
const yearElement = document.querySelector("[data-year]");
const mobileContact = document.querySelector(".mobile-contact");
const hero = document.querySelector(".hero");
const enquirySection = document.querySelector("#enquiry");

const BUSINESS_WHATSAPP = "916283089690";

// Service-page links carry a service choice, never personal enquiry details.
const enquiryTypes = {
  "home-purchase": "Home purchase",
  "corporate-housing": "Corporate housing",
  "commercial-lease": "Office or commercial lease",
  "commercial-purchase": "Property purchase or investment",
};
const enquiryType = new URLSearchParams(window.location.search).get("requirement");
if (Object.hasOwn(enquiryTypes, enquiryType)) {
  leadForm.elements.namedItem("requirement").value = enquiryTypes[enquiryType];
}

const purchaseRequirements = new Set(["Home purchase", "Property purchase or investment"]);
const requirementField = leadForm.elements.namedItem("requirement");
const purchaseBudgetField = leadForm.elements.namedItem("purchaseBudget");

function updatePurchaseBudget() {
  const isPurchase = purchaseRequirements.has(requirementField.value);
  leadForm.querySelector("[data-purchase-budget]").hidden = !isPurchase;
  purchaseBudgetField.disabled = !isPurchase;
}

requirementField.addEventListener("change", updatePurchaseBudget);
updatePurchaseBudget();

function updateHeader() {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
}

function updateMobileContact() {
  const enquiryRect = enquirySection.getBoundingClientRect();
  const enquiryIsVisible =
    enquiryRect.top < window.innerHeight * 0.9 && enquiryRect.bottom > window.innerHeight * 0.1;
  const shouldShow =
    window.innerWidth <= 820 && window.scrollY > hero.offsetHeight * 0.72 && !enquiryIsVisible;

  mobileContact.classList.toggle("is-visible", shouldShow);
}

function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  mobileMenu.classList.remove("is-open");
  header.classList.remove("menu-active");
  document.body.classList.remove("menu-open");
}

function toggleMenu() {
  const willOpen = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(willOpen));
  menuToggle.setAttribute("aria-label", willOpen ? "Close navigation" : "Open navigation");
  mobileMenu.classList.toggle("is-open", willOpen);
  header.classList.toggle("menu-active", willOpen);
  document.body.classList.toggle("menu-open", willOpen);
}

function validateLeadForm(form) {
  const requiredFields = [...form.querySelectorAll("[required]")];
  let firstInvalidField = null;

  requiredFields.forEach((field) => {
    const invalid = field.type === "checkbox" ? !field.checked : !field.value.trim();
    field.classList.toggle("field-error", invalid);
    field.setAttribute("aria-invalid", String(invalid));

    if (invalid && !firstInvalidField) {
      firstInvalidField = field;
    }
  });

  if (firstInvalidField) {
    firstInvalidField.focus();
    return false;
  }

  return true;
}

function buildWhatsAppMessage(data) {
  const company = data.get("company")?.trim() || "Not specified";
  const purchaseBudget = purchaseRequirements.has(data.get("requirement"))
    ? data.get("purchaseBudget")
    : null;

  return [
    "Hello 3D Nest Infra, I have a property requirement.",
    "",
    `Name: ${data.get("name").trim()}`,
    `Company: ${company}`,
    `Phone: ${data.get("phone").trim()}`,
    `Requirement: ${data.get("requirement")}`,
    ...(purchaseBudget ? [`Buying budget: ${purchaseBudget}`] : []),
    `Preferred market: ${data.get("market")}`,
    `Timeline: ${data.get("timeline")}`,
    "",
    `Brief: ${data.get("details").trim()}`,
  ].join("\n");
}

window.addEventListener(
  "scroll",
  () => {
    updateHeader();
    updateMobileContact();
  },
  { passive: true },
);
window.addEventListener("resize", updateMobileContact);
updateHeader();
updateMobileContact();

menuToggle.addEventListener("click", toggleMenu);

mobileMenu.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.08,
    },
  );

  document.querySelectorAll(".reveal").forEach((element) => {
    revealObserver.observe(element);
  });
} else {
  document.querySelectorAll(".reveal").forEach((element) => {
    element.classList.add("is-visible");
  });
}

leadForm.addEventListener("input", (event) => {
  if (event.target.matches("[required]")) {
    event.target.classList.remove("field-error");
    event.target.removeAttribute("aria-invalid");
    formStatus.textContent = "";
  }
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();

  // HTML starts closed: never submit named fields to the current page if setup fails.
  if (leadFields.disabled) {
    return;
  }

  if (!validateLeadForm(leadForm)) {
    formStatus.textContent = "Please complete the highlighted fields.";
    return;
  }

  formStatus.textContent = "";
  const formData = new FormData(leadForm);
  const message = buildWhatsAppMessage(formData);
  // Opening WhatsApp records intent; a lead exists only once the message is received.
  window.track3DNestEvent?.("enquiry_start", {
    method: "whatsapp",
    requirement_type: formData.get("requirement"),
    preferred_market: formData.get("market"),
  });
  const whatsappUrl = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
});

yearElement.textContent = new Date().getFullYear();

// Only enhance and enable the builder after its submit handler and setup exist.
// If this script is blocked or throws earlier, direct contact routes remain usable.
document.documentElement.classList.add("js");
leadFields.disabled = false;
enquiryFallback.hidden = true;
