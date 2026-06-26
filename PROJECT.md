# TENDs × Earth Cafe — Full Project Brief

This document covers everything built in the session that set up this project end-to-end. Use it to onboard Claude (or a developer) on a different computer with zero context loss.

---

## What This Is

A QR code activation for a brand collab between **TENDS™** (small-breed dog nutrition) and **Earth Cafe** (Mumbai). Cafe visitors scan the QR, land on a mobile page, fill in their dog's details, and claim a free TENDS pop. Their data is simultaneously saved to Airtable and added to a Klaviyo marketing list.

A separate analytics dashboard shows real-time engagement metrics pulled live from Airtable.

---

## Local Folder Structure

Everything lives at:
```
C:\Users\Admin\Downloads\TENDs & Earth\
│
├── index.html          ← The entire activation site (HTML + CSS + JS, one file)
├── dashboard.html      ← Local copy of the analytics dashboard
├── PROJECT.md          ← This file
├── vercel.json         ← Serverless function config
│
└── api\
    ├── submit.js       ← Handles form submission → Airtable + Klaviyo
    └── pageview.js     ← Logs every page visit → Airtable Visits table
```

Analytics dashboard (separate Vercel project):
```
C:\Users\Admin\Downloads\tends-analytics\
│
├── index.html          ← Dashboard UI with Chart.js
├── vercel.json         ← Serverless function config
│
└── api\
    └── data.js         ← Fetches Airtable Leads + Visits, returns JSON
```

---

## Live URLs

| What | URL |
|------|-----|
| Activation page | https://tends-earth.vercel.app |
| Analytics dashboard | https://tends-analytics.vercel.app |

---

## GitHub Repos

| Repo | URL |
|------|-----|
| tends-earth | https://github.com/abhimahamkali/tends-earth |
| tends-analytics | https://github.com/abhimahamkali/tends-analytics |

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

# For tends-earth
cd "TENDs & Earth"
vercel link --yes --project tends-earth
vercel deploy --prod

# For tends-analytics
cd tends-analytics
vercel link --yes --project tends-analytics
vercel deploy --prod
```

---

## Environment Variables

Both projects need these set in Vercel (already set — only needed if re-creating):

### tends-earth (set via Vercel dashboard or CLI)
| Variable | Where to find it |
|----------|-----------------|
| `AIRTABLE_PAT` | airtable.com → Account → Developer Hub → Personal access tokens → "TENDs × Earth — Leads" token |
| `KLAVIYO_PRIVATE_KEY` | klaviyo.com → Settings → API Keys → Private API Key |
| `KLAVIYO_LIST_ID` | `T2KazS` (the "Earth Cafe × TENDS" list — visible in the URL at klaviyo.com/list/T2KazS) |

### tends-analytics (set via Vercel dashboard or CLI)
| Variable | Where to find it |
|----------|-----------------|
| `AIRTABLE_PAT` | same token as above |

> 🔐 **Credentials are intentionally omitted from this file.** Retrieve them from the Vercel dashboard (Settings → Environment Variables) on the existing projects, or from the services directly.

To re-add an env var without BOM issues (use Bash, not PowerShell):
```bash
printf 'YOUR_VALUE_HERE' | vercel env add VARIABLE_NAME production --yes
```

> ⚠️ PowerShell `echo` adds a BOM character (U+FEFF) to the value which breaks API calls. Always use Bash `printf`.

---

## Airtable

**Base ID:** `appk6C18dNxzJvss7`
**Base name:** TENDs × Earth — Leads
**Direct link:** https://airtable.com/appk6C18dNxzJvss7

### Table: Leads (`tblco5qGhwJ7zePbo`)

Stores one row per form submission.

| Field | Type | Notes |
|-------|------|-------|
| Owner Name | Text | Person's name |
| Dog Name | Text | |
| WhatsApp | Text | Stored in E.164 format (+91XXXXXXXXXX) |
| Age | Text | Dog's age in years |
| Weight (kg) | Text | 1–10 kg dropdown |
| Activity Level | Text | One of three values from feeding calculator |
| Outlet | Single select | Auto-creates new options (typecast: true) |
| Source | Text | URL param `?src=` — defaults to 'earth-cafe-qr' |
| Consent | Checkbox | Always true (form requires it) |
| Submitted At | DateTime | ISO timestamp |

> ⚠️ **TODO:** `Owner Name` and `Activity Level` columns need to be added manually in Airtable UI — they were added to the API payload but the Airtable table was created before these fields existed. The data is being sent but may not be saving until the columns exist.

### Table: Visits (`tblpMxC5UeXyQuU5E`)

Stores one row per page load on tends-earth.vercel.app. This is the visits number shown in the analytics dashboard — **separate from form submissions**, so every visitor is counted even if they don't submit.

| Field | Type | Notes |
|-------|------|-------|
| Timestamp | DateTime | IST timezone |
| Outlet | Text | From `?outlet=` URL param |
| Source | Text | From `?src=` URL param |
| Date | Text | YYYY-MM-DD |

---

## Klaviyo

**Account:** abhimahamkali@gmail.com
**List:** Earth Cafe × TENDS (`T2KazS`)
**Direct link:** https://www.klaviyo.com/list/T2KazS

Profiles are created/upserted by phone number. Custom properties stored on each profile:
- `owner_name`, `dog_name`, `dog_age`, `dog_weight`, `activity_level`
- `outlet`, `source`, `partner` (always "Earth Cafe")

**API pattern used (two-step):**
1. `POST /api/profiles/` — upsert profile with custom properties (201 = new, 409 = existing)
2. `POST /api/lists/T2KazS/relationships/profiles/` — add profile ID to list (bypasses SMS consent requirement)

Phone numbers are auto-normalised to E.164: `9876543210` → `+919876543210`

---

## How the Activation Page Works (index.html)

### On page load
- Reads `?outlet=` and `?src=` URL params for QR attribution
- Fires `POST /api/pageview` immediately (logs the visit to Airtable — visitor counted even if they don't submit)
- Pre-selects the outlet chip if `?outlet=` matches a chip's `data-outlet`

### Page sections (top to bottom)
1. Hero — Earth Cafe × TENDS lockup
2. Pillars — "Small-Breed Only" and "Plant-Powered" cards
3. Outlet chips — "Where did you spot us?" (Bandra Waterfield, Juhu, Bandra BKC, Churchgate, Lower Parel)
4. Lead capture form
5. Success state (shown after submit)
6. Footer

### Form fields
1. Your name (owner)
2. Your dog's name
3. Dog's age (text) + Dog's weight in kg (dropdown 1–10)
4. Activity level (dropdown):
   - Mostly Calm — Quiet lifestyle, mostly indoors
   - Playful / Normal — Daily walks + regular play
   - Very Active — Long walks, runs, high energy
5. WhatsApp number
6. Consent checkbox

### On form submit
- Validates phone (min 7 digits) and consent checkbox
- Fires `POST /api/submit` with the full lead object
- Shows success screen immediately (doesn't wait for API response)
- `api/submit.js` runs server-side:
  - Normalises phone to +91XXXXXXXXXX
  - Saves to Airtable Leads table
  - Creates/updates Klaviyo profile and adds to list

### QR URL format
```
https://tends-earth.vercel.app/?outlet=juhu&src=earth-cafe-qr
https://tends-earth.vercel.app/?outlet=bandra-waterfield&src=earth-cafe-qr
https://tends-earth.vercel.app/?outlet=churchgate&src=earth-cafe-qr
```
Outlet values: `bandra-waterfield`, `juhu`, `bandra-bkc`, `churchgate`, `lower-parel`

---

## How the Analytics Dashboard Works

**URL:** https://tends-analytics.vercel.app

### Data flow
1. Dashboard loads → fetches `GET /api/data`
2. `/api/data` calls Airtable API, reads all Leads + all Visits records
3. Returns computed summary: outlet breakdown, leads/visits by date, leads by hour of day
4. Dashboard renders charts and table from real data
5. Auto-refreshes every 60 seconds

### Charts
- **Line chart** — Visits vs Leads per day (shows conversion rate in tooltip)
- **Donut chart** — Lead breakdown by outlet
- **Bar chart** — Submissions by time of day (IST, 2-hour slots)

### KPI cards
- Total Visits (page loads, independent of submissions)
- Total Leads (form submissions)
- Conversion Rate (leads / visits × 100)
- Active Outlets (distinct outlets with at least 1 lead)

### Recent leads table
- Last 10 submissions, newest first
- Phone numbers masked: `+91 98XXX XXXXX`

---

## Key Technical Decisions & Fixes Made

### BOM in env vars
PowerShell `echo "value" | vercel env add` prepends a U+FEFF byte-order mark which breaks API auth. Fix: always use Bash `printf 'value' | vercel env add ...`

### Klaviyo phone-only profiles
Klaviyo's bulk subscription endpoint requires SMS configuration when creating phone-only profiles. Workaround: use two separate calls — `POST /api/profiles/` first, then `POST /api/lists/{id}/relationships/profiles/` with the returned profile ID. This bypasses the SMS consent requirement.

### Airtable Outlet field is a single-select
Any outlet name not pre-defined as an option causes a 422 error. Fix: add `typecast: true` to the Airtable POST body — it auto-creates new select options on the fly.

### Phone normalisation
Raw input like `9876543210` doesn't pass Klaviyo's E.164 validation. Fix in `api/submit.js`:
```js
const phone = rawPhone.startsWith('+') ? rawPhone : '+91' + rawPhone.replace(/^0+/, '');
```

### Vercel project linking
The folder name "TENDs & Earth" (spaces + ampersand) caused `vercel deploy` to fail without first linking. Fix: run `vercel link --yes --project tends-earth` before deploying.

---

## CSS Design Tokens

```css
--navy:    #1B2A4A   /* dark blue — hero, offer card */
--cream:   #FBF7EC   /* page background */
--gold:    #CD3A54   /* red/rose — CTAs, accents */
--gold-dk: #a82e45   /* darker red — hover states */
--sage:    #6E8A7F   /* muted green — confirmation text */
--mute:    #7a7468   /* grey — secondary text */
```

Font: **Gambarino** (display), embedded as base64 woff2 — do not remove from index.html.
Site is mobile-first, max-width 480px.

---

## What's Left / Next Steps

- [ ] Add `Owner Name` and `Activity Level` columns to Airtable Leads table manually (so those fields save correctly)
- [ ] Design Klaviyo welcome flow: Day 0 welcome → Day 3 breed education → Day 7 first purchase offer
- [ ] Brief all 5 outlet staff on QR + free pop script
- [ ] Connect Vercel GitHub integration so pushes to `main` auto-deploy (currently deploying via CLI)
- [ ] Once enough data accumulates, use the analytics dashboard to identify top-performing outlet and replicate
