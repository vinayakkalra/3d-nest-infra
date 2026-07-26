# 3D Nest Infra Website

A responsive, static lead-generation website for 3D Nest Infra.

## Run locally

The website has no build step. Open `index.html` directly in a browser, or use
any static file server:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Lead form

The enquiry form validates the required fields and opens a prefilled WhatsApp
message to `+91 91155 20020`. No form data is stored by the website.

The WhatsApp number is configured in:

- `index.html` for direct links
- `script.js` as `BUSINESS_WHATSAPP`

## Public launch checklist

- Confirm the primary public phone number.
- Create and add the official company email.
- Confirm the final domain and add the canonical URL and Open Graph URL.
- Confirm the LinkedIn company-page URL.
- Add named client or assignment references only with approval.
- Add privacy and terms pages if a backend form, cookies or analytics are added.
- Replace representative imagery with approved real property photography when
  suitable images are available.

## Brand assets

Website imagery is stored under `assets/`.

- `logo-icon.png`
- `logo-lockup.png`
- `tricity-corridor-hero.webp`
- `corporate-workspace.webp`
- `executive-residence.webp`

The three property images are generated representative brand imagery and are
not current property listings.
