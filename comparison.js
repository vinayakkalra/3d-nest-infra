"use strict";

// A plain-text representation is shared by download and print. User entries are
// written only to textContent or a local text file, never to markup or a URL.
function buildPropertyComparisonText(comparison = {}) {
  const lines = [
    "3D NEST INFRA — PROPERTY COMPARISON",
    "Your notes on up to three properties. Blank fields mean Not recorded.",
    "",
  ];
  const addField = (label, value) => {
    const text = String(value ?? "").replace(/\r\n?/g, "\n");
    lines.push(`${label}:`, text.trim() ? text : "Not recorded", "");
  };

  addField("Comparison date", comparison.date);
  addField("Your priorities", comparison.priorities);

  (comparison.properties || []).forEach((property, index) => {
    lines.push(`PROPERTY ${index + 1}`, "────────────────────────────");
    property.fields.forEach((field) => addField(field.label, field.value));
  });

  lines.push(
    "Use the same area basis and check what each quote includes before comparing.",
    "Keep unanswered questions open until you have the relevant information.",
    "",
    "Prepared with the 3D Nest Infra property comparison worksheet.",
    "https://3dnestinfra.com/property-comparison-mohali.html",
    "Contact: karan@3dnestinfra.com | +91 62830 89690",
  );
  return `${lines.join("\n")}\n`;
}

(() => {
  if (typeof document === "undefined") return;

  const workspace = document.querySelector("[data-comparison-workspace]");
  if (!workspace) return;

  const summary = document.querySelector("[data-comparison-summary]");
  const status = document.querySelector("[data-comparison-status]");
  const downloadButton = document.querySelector("[data-download-comparison]");
  const printButton = document.querySelector("[data-print-comparison]");

  function readComparison() {
    return {
      date: workspace.querySelector("#comparison-date").value,
      priorities: workspace.querySelector("#comparison-priorities").value,
      properties: [...workspace.querySelectorAll("[data-property-card]")].map(
        (card) => ({
          fields: [...card.querySelectorAll("[data-comparison-field]")].map(
            (field) => ({
              label: field.dataset.comparisonField,
              value: field.value,
            }),
          ),
        }),
      ),
    };
  }

  function updateSummary() {
    const text = buildPropertyComparisonText(readComparison());
    summary.textContent = text;
    return text;
  }

  workspace.addEventListener("input", () => {
    updateSummary();
    status.textContent = "";
  });
  workspace.addEventListener("change", updateSummary);
  // Browser-menu printing uses the same complete, wrapping text as the button.
  window.addEventListener("beforeprint", updateSummary);

  downloadButton.addEventListener("click", () => {
    const file = new Blob([updateSummary()], { type: "text/plain;charset=utf-8" });
    const localUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = localUrl;
    link.download = "3d-nest-infra-property-comparison.txt";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(localUrl), 1000);
    status.textContent = "Your text download is ready. Keep a copy before leaving this page.";
  });

  printButton.addEventListener("click", () => {
    updateSummary();
    window.print();
  });

  updateSummary();
  document.body.classList.add("comparison-ready");
  downloadButton.hidden = false;
  printButton.hidden = false;
})();
