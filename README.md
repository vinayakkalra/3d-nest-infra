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

## Lead form

The enquiry form validates the required fields and opens a prefilled WhatsApp
message to `+91 836 054 3374`. No form data is stored by the website.

The WhatsApp number is configured in:

- `index.html` for direct links
- `script.js` as `BUSINESS_WHATSAPP`

## Google Analytics

The site includes a consent-controlled GA4 integration and contact-event
tracking in `analytics.js`. Replace `G-REPLACE_WITH_ID` with the GA4 web
stream's Measurement ID before publishing. Google Analytics is loaded only
after the visitor allows analytics; advertising storage and personalisation
remain disabled.

## Public launch checklist

- Confirm the primary public phone number.
- Verify that `partnerships@3dnestinfra.com` can receive mail before launch.
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
site acquisition and Mohali/Tricity coverage. It also includes:

- descriptive page titles and meta descriptions;
- Organization, Service and FAQ structured data;
- crawl-friendly semantic HTML and internal links;
- `robots.txt`;
- `llms.txt` and `llms-full.txt` with a factual business reference.

The confirmed canonical origin is `https://3dnestinfra.com`.
