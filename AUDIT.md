# DSM Photography — Repository Audit
**Date:** April 15, 2026  
**Repo:** `dsm-shotlist` (Netlify + Supabase + SendGrid)

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [File Inventory](#file-inventory)
3. [CSS Color System](#css-color-system)
4. [Package Pricing — All Services](#package-pricing--all-services)
5. [Backend Functions](#backend-functions)
6. [Notable Issues](#notable-issues)

---

## Project Overview

DSM Photography is a Miami-based photography business site for **Dayna S. McKenzie**. It is a static site deployed on **Netlify**, with **Netlify Functions** as the serverless backend. Client data is stored in **Supabase** and emails are sent via **SendGrid**.

**Tech stack:**
- Frontend: Vanilla HTML/CSS/JS
- Backend: Netlify Functions (Node.js, bundled with esbuild)
- Database: Supabase (PostgreSQL)
- Email: SendGrid (`@sendgrid/mail ^8.1.3`)
- PDF generation: `pdfkit ^0.15.0` (dependency present, not yet used in functions)
- Fonts: Cormorant Garamond, Montserrat, Josefin Sans, Raleway (Google Fonts)

**Environment variables required:** `SUPABASE_URL`, `SUPABASE_KEY`, `SENDGRID_API_KEY`

**Supabase tables used:** `inquiries`, `bookings`, `contracts`, `shot_lists`

**Security headers (all routes):** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`

---

## File Inventory

### Config
| File | Purpose |
|---|---|
| `README.md` | Single line: `# dsm-shotlist` |
| `package.json` | Project config, dependencies |
| `netlify.toml` | Build config, functions dir, security headers |

### Pages
| File | Description |
|---|---|
| `index.html` | Homepage — hero, about, services grid, portfolio placeholder, inquiry form |
| `services.html` | Services overview — spotlight banner, seasonal section (Graduations), all-services grid |
| `portraits.html` | Portrait sessions — packages, add-ons table, inquiry form |
| `graduations.html` | Graduation sessions — packages, add-ons, inquiry form |
| `events.html` | Event coverage — packages (dark nav variant), add-ons, inquiry form |
| `contact.html` | Standalone contact/inquiry form (dark page, no nav loader) |
| `portal.html` | Client portal — loads booking data by `?token=` URL param |
| `shotlist.html` | Shot list submission form (loaded from client portal) |
| `admin.html` | Admin dashboard — password-gated lock screen, studio management UI |

### Shared Components
| File | Purpose |
|---|---|
| `nav.html` | Shared nav markup (loaded dynamically by `nav.js`) |
| `nav.css` | Shared nav styles, dark variant, mobile hamburger menu |
| `nav.js` | Fetches and injects nav, handles dark variant, hamburger toggle, active link, CTA redirect |
| `footer.html` | Shared footer markup |
| `footer.css` | Shared footer styles |
| `footer.js` | Fetches and injects footer |

### Netlify Functions
| File | Method | Purpose |
|---|---|---|
| `functions/submit-inquiry.js` | POST | Main inquiry form handler — saves to Supabase, sends intake email to Dayna + confirmation to client |
| `functions/create-booking.js` | POST | Creates booking record with auto-incremented `DSM-INV-NNNN` invoice number and 48-char portal token |
| `functions/get-booking.js` | GET `?token=` | Returns booking + contracts + shot list by portal token |
| `functions/get-inquiry.js` | GET `?ref_number=` | Returns inquiry by reference number |
| `functions/get-next-invoice.js` | GET | Returns next available invoice number |
| `functions/send-client-email.js` | POST | Sends branded HTML email to client (invoice, deposit, balance types) |
| `functions/submit-contract.js` | POST | Saves signed contract, prevents double-signing (409), sends confirmation emails |
| `functions/submit-shot-list.js` | POST | Upserts shot list (allows resubmission), sends summary to Dayna + confirmation to client |

### Assets
| Path | Contents |
|---|---|
| `assets/DSM_LOGOSaiFiles-01` through `-06.png` | Logo variants |
| `assets/website-main-day.jpeg` | About section photo of Dayna |
| `assets/gallery/grad-01` through `grad-06.jpg` | Graduation gallery photos |
| `assets/documents/` | `DSM_Master_Agreement.pdf`, `DSM_Event_Addendum.pdf`, `DSM_Portrait_Addendum.pdf`, `DSM_Event_Client_Guide.pdf` |

---

## CSS Color System

The site uses two slightly different color palettes across pages. Pages using the `nav.css` design system use cooler/more muted gold; standalone pages use a warmer gold.

### Primary palette — `nav.css`, `services.html`, `portraits.html`, `events.html`, `graduations.html`, `portal.html`, `admin.html`

| Variable | Hex |
|---|---|
| `--gold` | `#C9A96E` |
| `--gold-light` | `#E2C99A` |
| `--gold-pale` | `#F5EDD8` |
| `--mint` | `#8FBCB2` |
| `--mint-light` | `#B8D8D3` |
| `--blush` | `#E8C5B8` |
| `--blush-light` | `#F4DDD5` |
| `--warm-white` | `#FDFAF6` |
| `--charcoal` | `#2C2C2C` |
| `--charcoal-deep` | `#1E1E1E` |
| `--mid` | `#6B6560` |
| `--light-text` | `#9B9490` |
| `--border` | `rgba(201,169,110,0.2)` |
| `--border-dark` | `rgba(201,169,110,0.25)` |

### Alternate palette — `index.html`, `contact.html`

| Variable | Hex |
|---|---|
| `--gold` | `#dec08c` |
| `--goldl` / `--gold-light` | `#f4d7a4` / `#edddb0` |
| `--mint` | `#a8dbd2` |
| `--blush` | `#f5d2c4` |
| `--dark` | `#100f09` |
| `--warm` / `--warm-white` | `#fdfaf6` |
| `--text` | `#2c2418` |
| `--muted` | `#8a7d72` |
| `--terra` (contact.html only) | `#c9856a` |
| `--slate` (contact.html only) | `#8aabb5` |
| `--taupe` (contact.html only) | `#b8a99a` |

### `shotlist.html` palette

| Variable | Hex |
|---|---|
| `--gold` | `#dec08c` |
| `--gold-lt` | `#f4d7a4` |
| `--gold-dk` | `#c8a870` |
| `--gold-deep` | `#a07840` |
| `--mint` | `#a8dbd2` |
| `--mint-dk` | `#6db5a8` |
| `--ink` | `#1c1a18` |
| `--ink-mid` | `#3a3630` |
| `--ink-soft` | `#5c5650` |
| `--stone` | `#8a8480` |
| `--parch` | `#faf7f2` |
| `--error` | `#b5342a` |

### `portal.html` / `admin.html` additions

| Variable | Hex |
|---|---|
| `--gold-d` | `#a8813e` |
| `--mint-d` | `#6a9e94` |
| `--ink` | `#1c1a18` |
| `--border-lt` | `#ece7de` |

---

## Package Pricing — All Services

---

### Portraits

> All packages include a private PASS gallery and high-resolution downloads.

| Package | Price | Duration | Images | Looks / Locations | Delivery |
|---|---|---|---|---|---|
| **Exposure** | $125 | 20–30 min | 5–8 retouched | 1 look / 1 location | 5 business days |
| **Aperture** ★ | $275 | 1 hour | 10–15 retouched | 2 looks / 1–2 locations | 7 business days |
| **Prism** | $550 | 90 min | 18–25 retouched | 3 looks / 2–3 locations | 10 business days |

Prism includes: premium editing, pre-session consultation (15–20 min), complimentary 5x7 print.

#### Portrait Add-ons

| Add-On | Exposure | Aperture | Prism |
|---|---|---|---|
| Premium Editing Upgrade | — | +$50 | — (included) |
| Additional Images (+5) | — | +$60 (+$75 w/ Premium Editing) | +$75 |
| Additional Look | — | +$50 | +$50 |
| Additional Location | — | +$40 | +$40 |
| Expedited Delivery (48 hrs) | +$50 | +$75 | +$100 |
| Print Release Letter | — | +$25 | +$25 |
| Licensed Commercial Use | — | +$40 | +$40 |
| Print + Commercial Bundle | — | +$55 | +$55 |

---

### Graduations

> Session promo: Save $50 on any package with code **GRAD2026** before May 31, 2026.  
> Travel included within Miami-Dade and Broward; Palm Beach County billed at $0.75/mile from Miami.

| Package | Price | Duration | Images | Looks / Locations | Delivery |
|---|---|---|---|---|---|
| **Milestone** | $275 | 45 min | 10–15 retouched | 1 look (regalia or personal) / 1 location | 5 days |
| **Celebration** ★ | $375 | 75 min | 18–25 retouched | 2 looks (regalia + personal) / 1–2 locations | 7 days |
| **Legacy** | $525 | 2 hours | 25–35 retouched | 3 looks / 2–3 locations | 7 days |

Legacy includes: full B&W duplicate set of all finals, one printed 5x7 of hero image.

#### Graduation Add-ons

| Add-On | Price |
|---|---|
| Expedited 5-day delivery | +$75 |
| Expedited 48-hour delivery | +$150 |
| Additional look | +$50 |
| Additional location | +$40 |
| Graduation announcement cards (set of 25, design included) | $65 |
| Thank-you cards (set of 25, design included) | $65 |
| Announcement + thank-you bundle (both sets of 25, save $10) | $120 |
| Print release | +$25 |
| Commercial use license | +$40 |

---

### Events

> All packages include lighting and color correction, a private PASS gallery, and high-resolution downloads.  
> Balance due 7 days prior to the event. Travel fees apply beyond 30 miles from Miami ($0.75/mile round trip).

| Package | Price | Duration | Images | Extras | Delivery |
|---|---|---|---|---|---|
| **Essential** | $350 | 2 hours | 75+ retouched | — | 7 business days |
| **Signature** ★ | $525 | 2.5 hours | 125+ retouched | — | 7 business days |
| **Premier** | $750 | 2.5 hrs + 30 min pre-event | 175+ retouched | Up to 3 group sessions, printed thank-you card set (4x6, mailed) | 7 business days |

#### Event Add-ons

| Add-On | Price |
|---|---|
| Expedited Delivery (5 business days) | +$100 |
| Expedited Delivery (48 hours) | +$200 |
| Additional Coverage Hour | +$150 |
| Additional Retouched Images (+25) | +$75 |
| Group Photo Session (up to 3 groupings — Essential & Signature only) | +$75 |
| Additional Group Groupings (beyond included/purchased) | +$20 each |
| Print Release Letter | +$25 |
| Licensed Commercial Use | +$40 |
| Print + Commercial Bundle (save $10) | +$55 |

---

### Coming Soon (no pricing yet)
Headshots, Lifestyle, Maternity, Engagements, Proposals, Weddings, Real Estate, Fine Art, Print Sales, Gallery

---

## Backend Functions

### Reference number format
`DSM-YYYYMMDD-{TYPE}-{NNNN}`  
Example: `DSM-20260415-GRD-1001`

**Type codes:** `EVT` Events · `PRT` Portraits · `HDT` Headshots · `LST` Lifestyle · `MAT` Maternity · `ENG` Engagements · `PRP` Proposals · `WED` Weddings · `CRE` Creative · `RST` Real Estate · `GEN` General · `OTH` Other · `GRD` Graduation

### Invoice number format
`DSM-INV-{NNNN}` — auto-incremented from highest existing booking

### Portal token
48-character hex string generated with `crypto.randomBytes(24)`

### Inquiry urgency flag
An inquiry is flagged **URGENT** if any date field is within 60 days of submission. Triggers a banner in Dayna's intake email and a `⚑ URGENT` tag in the email subject line.

### Email accent colors by type
| Type | Accent |
|---|---|
| Events (`EVT`) | `#dec08c` |
| Portraits, Headshots, Lifestyle, Maternity (`PRT/HDT/LST/MAT`) | `#f5d2c4` |
| Engagements, Proposals, Weddings (`ENG/PRP/WED`) | `#a8dbd2` |
| Creative (`CRE`) | `#c9856a` |
| Real Estate (`RST`) | `#8aabb5` |
| General / Other (`GEN/OTH`) | `#b8a99a` |
| Graduation (`GRD`) | `#E8C5B8` |
| Invoice emails | `#C9A96E` |
| Deposit emails | `#8FBCB2` |
| Balance emails | `#4a8a4a` |

---

## Notable Issues

1. **Two gold palettes** — `nav.css`-based pages use `#C9A96E` (cooler); `index.html`, `contact.html`, `shotlist.html`, and email templates use `#dec08c` (warmer). This is a visual inconsistency across the site.

2. **Nav link mismatch** — `nav.html` links to `/client-portal.html` but the actual file is `portal.html`. This link will 404.

3. **`footer.css` references `--dark`** — but `--dark` is not defined in `nav.css` or `footer.css` itself. It must be defined per-page. Pages that don't define it will render the footer with a transparent/fallback background.

4. **`pdfkit` is a declared dependency** but is not used in any current function. Likely reserved for future contract/invoice PDF generation.

5. **`admin.html` password check is client-side** — the lock screen password is validated in the browser, which is not secure for protecting sensitive studio data. Should be moved to a server-side auth mechanism.
