# TENDs × Earth Cafe — Full Project Brief

This document covers everything built to set up this project end-to-end. Use it to onboard Claude (or a developer) on a different computer with zero context loss.

---

## What This Is

A QR code activation for a brand collab between **TENDS™** (small-breed dog nutrition) and **Earth Cafe** (Mumbai). Cafe visitors scan a QR code, land on a mobile page, fill in their dog's details, and claim a free TENDS pop. Their data is simultaneously saved to Airtable and added to a Klaviyo marketing list.

A separate analytics dashboard shows real-time engagement metrics pulled live from Airtable — no dummy data, everything is computed fresh on every page load.

---

## Local Folder Structure

Everything you need is in one zippable folder:

```
C:\Users\Admin\Downloads\TENDs & Earth\
│
├── index.html          ← The entire activation site (HTML + CSS + JS, one self-contained file)
├── dashboard.html      ← Local copy of the analytics dashboard (same as tends-analytics.vercel.app)
├── PROJECT.md          ← This file
├── vercel.json         ← Serverless function timeout config
│
└── api\
    ├── submit.js       ← Form submission handler → Airtable + Klaviyo
    └── pageview.js     ← Page visit logger → Airtable Visits table (fires on every page load)
```

Analytics dashboard (separate Vercel project, separate folder):
```
C:\Users\Admin\Downloads\tends-analytics\
│
├── index.html          ← Dashboard UI (Chart.js, all data from /api/data)
├── vercel.json         ← Serverless function config
│
└── api\
    └── data.js         ← Reads Airtable Leads + Visits, returns aggregated JSON
```

> The `TENDs & Earth` folder is the one to zip and carry. It contains `dashboard.html` as a local copy so you have everything in one place.

---

## Live URLs

| What | URL |
|------|-----|
| Activation page | https://tends-earth.vercel.app |
| Analytics dashboard | https://tends-analytics.vercel.app |

---

## GitHub Repos

| Repo | URL | Contains |
|------|-----|----------|
| tends-earth | https://github.com/abhimahamkali/tends-earth | index.html, api/submit.js, api/pageview.js, vercel.json, PROJECT.md, dashboard.html |
| tends-analytics | https://github.com/abhimahamkali/tends-analytics | index.html, api/data.js, vercel.json |

Both repos are on the `main` branch. To clone on a new computer:
```bash
git clone https://github.com/abhimahamkali/tends-earth.git
git clone https://github.com/abhimahamkali/tends-analytics.git
```

---

## Vercel Projects

| Project | ID | Production URL |
|---------|-----|---------------|
| tends-earth | prj_EKHs6vCbABYG7fLpyT6qXx9XUaBY | https://tends-earth.vercel.app |
| tends-analytics | prj_zlFkNoBznDkkMKeFFE3UuD7bTUBO | https://tends-analytics.vercel.app |

Team/Org ID: `team_9p4dhjKDbueLytAO43HQ71xk`

### Deploying from a new computer
```bash
npm i -g vercel
vercel login   # log in with abhimahamkali@gmail.com

# Activation page
cd "TENDs & Earth"
vercel link --yes --project tends-earth
vercel deploy --prod

# Analytics dashboard
cd tends-analytics
vercel link --yes --project tends-analytics
vercel deploy --prod
```

> ⚠️ The folder name "TENDs & Earth" (spaces + ampersand) will cause `vercel deploy` to fail if the project isn't linked first. Always run `vercel link` before deploying from a fresh clone.

---

## Environment Variables

Already set in Vercel — only needed again if re-creating the projects from scratch.

### tends-earth
| Variable | Where to find it |
|----------|-----------------|
| `AIRTABLE_PAT` | airtable.com → Account → Developer Hub → Personal access tokens → "TENDs × Earth — Leads" |
| `KLAVIYO_PRIVATE_KEY` | klaviyo.com → Settings → API Keys → Private API Key |
| `KLAVIYO_LIST_ID` | `T2KazS` — visible in the URL at klaviyo.com/list/T2KazS |

### tends-analytics
| Variable | Where to find it |
|----------|-----------------|
| `AIRTABLE_PAT` | same token as above |

> 🔐 Credentials are intentionally omitted from this file. Retrieve them from Vercel dashboard → Settings → Environment Variables on the existing projects.

To re-add an env var without BOM corruption (use Bash, not PowerShell):
```bash
printf 'YOUR_VALUE_HERE' | vercel env add VARIABLE_NAME production --yes
```

> ⚠️ PowerShell `echo` adds a BOM character (U+FEFF) which breaks API auth headers silently. Always use Bash `printf`.

---

## Airtable

**Account:** abhimahamkali@gmail.com
**Base ID:** `appk6C18dNxzJvss7`
**Base name:** TENDs × Earth — Leads
**Direct link:** https://airtable.com/appk6C18dNxzJvss7

### Table: Leads (`tblco5qGhwJ7zePbo`)

One row per form submission.

| Field | Type | Notes |
|-------|------|-------|
| Owner Name | Text | Person's own name |
| Dog Name | Text | |
| WhatsApp | Text | E.164 format — auto-prefixed with +91 |
| Age | Text | Dog's age in years |
| Weight (kg) | Text | Value from 1–10 dropdown |
| Activity Level | Text | One of: mostly-calm / playful-normal / very-active |
| Outlet | Single select | `typecast: true` — auto-creates new options on the fly |
| Source | Text | From `?src=` URL param, defaults to 'earth-cafe-qr' |
| Consent | Checkbox | Always true (form blocks submit without it) |
| Submitted At | DateTime | ISO timestamp (UTC) |

> ⚠️ `Owner Name` and `Activity Level` were added to the form after the table was created. If these columns don't exist in Airtable yet, add them manually (Text type) so the data saves correctly.

### Table: Visits (`tblpMxC5UeXyQuU5E`)

One row per page load on tends-earth.vercel.app. Fired immediately on page open — **completely independent of form submission**. This is what powers the "Total Visitors" KPI in the dashboard, which is always higher than leads.

| Field | Type | Notes |
|-------|------|-------|
| Timestamp | DateTime | IST timezone |
| Outlet | Text | From `?outlet=` URL param (blank if direct link) |
| Source | Text | From `?src=` URL param |
| Date | Text | YYYY-MM-DD |

---

## Klaviyo

**Account:** abhimahamkali@gmail.com
**List:** Earth Cafe × TENDS (`T2KazS`)
**Direct link:** https://www.klaviyo.com/list/T2KazS

Profiles are upserted by phone number (deduped — same phone = same profile updated, not duplicated). Custom properties stored:
- `owner_name`, `dog_name`, `dog_age`, `dog_weight`, `activity_level`
- `outlet`, `source`, `partner` (always "Earth Cafe")

**API pattern (two-step — important):**
1. `POST /api/profiles/` — upsert profile with custom properties. Returns 201 (new) or 409 (existing — profile ID is in `errors[0].meta.duplicate_profile_id`)
2. `POST /api/lists/T2KazS/relationships/profiles/` — add profile ID to list. Returns 204.

This two-step approach bypasses Klaviyo's SMS consent configuration requirement, which blocks the simpler bulk-subscribe endpoint for phone-only profiles.

Phone numbers are auto-normalised in `api/submit.js`:
```js
const phone = rawPhone.startsWith('+') ? rawPhone : '+91' + rawPhone.replace(/^0+/, '');
// 9876543210 → +919876543210
// 09876543210 → +919876543210
// +919876543210 → +919876543210
```

---

## How the Activation Page Works (`index.html`)

### On page load (before any interaction)
1. Reads `?outlet=` and `?src=` URL params
2. Immediately fires `POST /api/pageview` — logs the visit to Airtable (visitor counted whether or not they submit)
3. Pre-selects the matching outlet chip if `?outlet=` is in the URL

### Page sections (top to bottom)
1. **Hero** — Earth Cafe × TENDS lockup, tagline
2. **Pillars** — "Small-Breed Only" and "Plant-Powered" value prop cards
3. **Outlet chips** — "Where did you spot us?" selector (Bandra Waterfield, Juhu, Bandra BKC, Churchgate, Lower Parel)
4. **Lead capture form** — see fields below
5. **Success state** — shown after submit ("You're all set / Don't forget your free pop")
6. **Footer** — tendsmall.com | @tendsmall (single line)

### Form fields (current version)
1. Your name (owner's name)
2. Your dog's name
3. Dog's age (text input) + Dog's weight in kg (dropdown: 1–10)
4. Activity level (dropdown, matching TENDS feeding calculator):
   - `mostly-calm` → Mostly Calm — Quiet lifestyle, mostly indoors
   - `playful-normal` → Playful / Normal — Daily walks + regular play
   - `very-active` → Very Active — Long walks, runs, high energy
5. WhatsApp number
6. Consent checkbox ("It's okay for TENDS to reach out")

### On form submit
- Validates: phone ≥ 7 digits, consent checked
- Shows success screen immediately (fire-and-forget — doesn't block on API)
- `POST /api/submit` runs server-side in parallel:
  1. Normalises phone to E.164 (+91...)
  2. Saves full record to Airtable Leads table
  3. Upserts Klaviyo profile with dog data
  4. Adds profile to Earth Cafe × TENDS list

### QR URL format
Each outlet gets its own QR pointing to:
```
https://tends-earth.vercel.app/?outlet=juhu&src=earth-cafe-qr
https://tends-earth.vercel.app/?outlet=bandra-waterfield&src=earth-cafe-qr
https://tends-earth.vercel.app/?outlet=bandra-bkc&src=earth-cafe-qr
https://tends-earth.vercel.app/?outlet=churchgate&src=earth-cafe-qr
https://tends-earth.vercel.app/?outlet=lower-parel&src=earth-cafe-qr
```
The `outlet` param pre-selects the chip and is stored as attribution on both the lead and the visit.

---

## How the Analytics Dashboard Works (`tends-analytics.vercel.app`)

### Architecture
- Single HTML file (`index.html`) with Chart.js 4.4.0 (CDN)
- On every page load: fetches `GET /api/data` (serverless function)
- `/api/data` reads Airtable Leads + Visits tables (paginates through all records), computes aggregates, returns JSON
- Dashboard renders everything from the response — **zero hardcoded values in the HTML**
- Auto-refreshes every 60 seconds

### What `/api/data` returns
```json
{
  "leads": [...],         // last 20, newest first (for the table)
  "totalLeads": 6,
  "totalVisits": 12,
  "outletMap": { "Juhu": 3, "Bandra Waterfield": 2, ... },
  "leadsByDate": { "2026-06-26": 3, ... },
  "visitsByDate": { "2026-06-26": 5, ... },
  "byHour": [0,0,0,...],  // 24-element array, UTC hours
  "activityMap": { "mostly-calm": 2, ... }
}
```

### Dashboard sections
| Section | Data source |
|---------|-------------|
| Total Visitors KPI | `totalVisits` |
| Leads Captured KPI | `totalLeads` |
| Conversion Rate KPI | `totalLeads / totalVisits × 100` |
| Top Outlet KPI | Highest count in `outletMap` (excludes Unknown) |
| Daily Visitors vs Leads chart | `visitsByDate` + `leadsByDate` |
| Outlet Attribution donut | `outletMap` |
| Outlet Leaderboard | `outletMap` sorted descending |
| Conversion Funnel | `totalVisits` → `totalLeads` (2-step, real data only) |
| Time of day bar chart | `byHour` (converted to IST, grouped into 2h slots) |
| Recent Leads table | `leads` array, last 10, phone masked |

---

## Key Technical Fixes Made (important for future debugging)

### BOM in Vercel env vars
**Problem:** PowerShell `echo "value" | vercel env add` prepends U+FEFF (byte-order mark) silently. This caused `ByteString character at index 7 has value 65279` errors in API calls.
**Fix:** Always use Bash `printf 'value' | vercel env add VARNAME production --yes`

### Klaviyo phone-only profiles blocked by SMS config
**Problem:** `POST /api/lists/{id}/profile-subscription-bulk-create-jobs` requires SMS account configuration when the profile has no email — threw "SMS or WhatsApp configuration is required."
**Fix:** Split into two calls: create profile first (`POST /api/profiles/`), then add to list via relationship endpoint (`POST /api/lists/{id}/relationships/profiles/`). The relationship endpoint has no consent requirement.

### Airtable single-select rejects unknown options
**Problem:** Outlet field was a single-select with predefined options. Submitting "churchgate" (not in the list) caused a 422 error, silently dropping the Airtable save.
**Fix:** Add `typecast: true` to the Airtable POST body — it auto-creates new select options.

### Dashboard showing dummy data
**Problem:** All KPI values, funnel numbers, outlet leaderboard, and chart data were hardcoded in the HTML. The JS was writing to IDs that didn't exist on the elements.
**Fix:** Added IDs to every dynamic element. JS now populates all of them from `/api/data`. No hardcoded values remain anywhere in the dashboard HTML.

### Vercel deploy fails on folder with special characters
**Problem:** `vercel deploy` inside "TENDs & Earth" failed due to `&` and spaces in folder name.
**Fix:** Run `vercel link --yes --project tends-earth` first to create the `.vercel/project.json` binding, then `vercel deploy --prod` works.

---

## CSS Design Tokens (activation page)

```css
--navy:    #1B2A4A   /* dark blue — hero background, offer card */
--cream:   #FBF7EC   /* page background */
--gold:    #CD3A54   /* red/rose — CTAs, accents, kicker labels */
--gold-dk: #a82e45   /* darker red — hover states */
--sage:    #6E8A7F   /* muted green — success/confirmation text */
--mute:    #7a7468   /* grey — secondary text */
```

Font: **Gambarino** (display/serif), embedded as base64 woff2 inside the `<style>` block. Do not remove — it's not loaded from a CDN.
Layout: mobile-first, max-width 480px.

---

## What's Still Left To Do

- [ ] Add `Owner Name` and `Activity Level` columns to Airtable Leads table (Text type) if not already there
- [ ] Design Klaviyo welcome flow: Day 0 welcome → Day 3 breed/activity education → Day 7 first purchase offer
- [ ] Brief all 5 outlet staff on the QR code + free pop redemption script
- [ ] Connect Vercel GitHub integration so `git push` to `main` auto-deploys (currently deploying via CLI)
- [ ] Once enough real data accumulates (~50+ visits), use the dashboard to identify the top-converting outlet and replicate its setup at others
