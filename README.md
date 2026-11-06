# 3D Nest Infra Website

A responsive, static lead-generation website for 3D Nest Infra.

## Run locally

The website has no build step. Open `index.html` directly in a browser, or use
any static file server:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

Run the local SEO and link checks with:

```bash
node validate.mjs
```

After deployment, check that the public files match this checkout:

```bash
node audit-live.mjs
```

This read-only check reports missing or older public files and exits with code 1
until they match. It does not verify search indexing, rankings or Analytics delivery.
Use `node audit-live.mjs --json` for a dated machine-readable report.

## Lead form

The enquiry form validates the required fields and opens a prefilled WhatsApp
message to `+91 62830 89690`. No form data is stored by the website.

The WhatsApp number is configured in:

- `index.html` for direct links
- `script.js` as `BUSINESS_WHATSAPP`

## Google Analytics

The site includes a consent-controlled GA4 integration and contact-event
tracking in `analytics.js`. The GA4 web stream Measurement ID is configured in
that file. Google Analytics is loaded only after the visitor allows analytics;
advertising storage and personalisation remain disabled.

`contact_click` records phone, email and direct WhatsApp link clicks.
`enquiry_start` records a valid form submission that opens a prefilled WhatsApp
message; it does not confirm that the visitor sent the message. Record received
enquiries and qualified briefs in the lead tracker, and do not treat either
browser event as a completed lead.

## Public launch checklist

- Confirm the primary public phone number.
- Verify that `karan@3dnestinfra.com` can receive mail before launch.
- Point `3dnestinfra.com` to the chosen host and enforce HTTPS.
- Confirm that both `https://3dnestinfra.com` and
  `https://www.3dnestinfra.com` resolve to one preferred version. Redirect the
  other version permanently to `https://3dnestinfra.com`.
- Submit `https://3dnestinfra.com/sitemap.xml` in Google Search Console and
  Bing Webmaster Tools after the site is live.
- Claim or update the Google Business Profile with the same business name,
  phone, service area and final website URL.
- Set up Google Business Profile as a service-area business only if the business
  meets customers in person. Keep the address hidden because customers are not
  served at an office. Do not use a virtual office or mailbox.
- Confirm the LinkedIn company-page URL.
- Keep named client or assignment references limited to those approved for publication.
- Review the privacy notice whenever analytics, enquiry handling or data practices change.
- Replace representative imagery with approved real property photography when
  suitable images are available.

## Brand assets

Website imagery is stored under `assets/`.

- `logo-icon.png`
- `logo-lockup.png`
- `social-preview.jpg`
- `tricity-corridor-hero.webp`
- `corporate-workspace.webp`
- `executive-residence.webp`

The three property images are generated representative brand imagery and are
not current property listings.

## Search and AI discovery

The website includes unique pages for corporate housing, commercial property,
site acquisition and Mohali/Tricity coverage. The current primary pages are:

- `home-buying-mohali.html`: ready-to-move apartments, resale homes, plots and
  information-led research into upcoming projects;
- `karan-kalra.html`: founder biography and contact routes;
- `property-experience.html`: owner-supplied residential experience, existing
  corporate references and a retail requirement-stage example.
- `home-buying-checklist-mohali.html`: an educational buyer checklist, with a
  downloadable text brief at `assets/home-buying-brief.txt`.
- `property-comparison-mohali.html`: a three-property worksheet with a blank
  offline text sheet, completed-text download and a full print summary.

Service-page enquiry links preselect the appropriate service through a small
allowlist in `script.js`. Query parameters do not carry personal enquiry data.
The comparison worksheet uses only `comparison.js`; it does not load Analytics
or send, store or add worksheet entries to an enquiry. Entries last in the current
tab until the visitor leaves or refreshes, so the page prompts them to download or
print a copy. The rest of the website retains its existing consented analytics.

Home-buying enquiries are guided by current budget, requirements and timing,
without a minimum budget eligibility rule. Buying enquiries have an optional
free-text budget field; it is disabled and omitted from the WhatsApp message
for rental and corporate housing requirements.
The founder page uses the approved AI-assisted portrait at
`assets/karan-kalra-founder.jpg`; replace this asset when a suitable original
portrait is supplied.

The website also includes:

- descriptive page titles and meta descriptions;
- Organization, Service and FAQ structured data;
- crawl-friendly semantic HTML and internal links;
- `robots.txt`;
- `llms.txt` and `llms-full.txt` with a factual business reference.

The confirmed canonical origin is `https://3dnestinfra.com`.
