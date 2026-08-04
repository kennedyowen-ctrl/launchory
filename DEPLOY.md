# Launchory — Launch & Deployment Guide

Everything to take Launchory live on **joinlaunchory.com** with a working
Early Access database. Nothing here needs a build step: it's a static site
(`index.html` + assets) plus **Supabase** for storing applications.

```
launchory-deploy/
├─ index.html          # the app (Early Access built in)
├─ og-image.png        # social share image
├─ favicon.svg         # favicon
├─ robots.txt          # SEO
├─ sitemap.xml         # SEO
├─ vercel.json         # redirects (www→apex), security headers, caching
├─ supabase-schema.sql # run once in Supabase
└─ DEPLOY.md           # this file
```

---

## Part 1 — Set up the database (Supabase)

Do this first so you have the keys the site needs.

1. Create a project at **supabase.com** (free tier is fine). Pick a region close to you.
2. In the project, open **SQL Editor → New query**, paste the contents of
   `supabase-schema.sql`, and click **Run**. This creates the `early_access`
   table, a unique index on email (prevents duplicates), field validation, and
   Row Level Security so the public site can *insert* applications but not read them.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** — looks like `https://abcdxyz.supabase.co`
   - **anon public key** — a long JWT. (This key is safe to expose in the
     browser; RLS is what protects your data. Never put the *service_role* key
     in the site.)
4. Open `index.html`, find the `window.LAUNCHORY_CONFIG` block near the top, and
   paste them in:
   ```html
   <script>
   window.LAUNCHORY_CONFIG = {
     SUPABASE_URL: "https://abcdxyz.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...your-anon-key...",
     GA_ID: "",            // optional, see Part 4
     POSTHOG_KEY: "",      // optional, see Part 4
     POSTHOG_HOST: "https://us.i.posthog.com"
   };
   </script>
   ```

That's the whole integration. Submissions now save straight to Supabase, and
the form prevents duplicate emails and validates every field (client-side for a
fast, friendly experience, and again in the database as a hard guarantee).

**Where to see applicants:** Supabase **Table Editor → early_access**, or run
the `founders` / `creatives` views the schema created. To export emails, run in
the SQL editor:
```sql
select string_agg(email, e'\n') from public.early_access;                  -- everyone
select string_agg(email, e'\n') from public.early_access where role='founder';
```
You can also **Export to CSV** from the Table Editor.

---

## Part 2 — Deploy to Vercel

Two ways; both take a couple of minutes.

**Option A — drag & drop (fastest)**
1. Go to **vercel.com → Add New → Project → Deploy** (or the "Upload" option).
2. Drag the **contents** of `launchory-deploy/` in (the files, not the folder).
3. Framework preset: **Other**. Build command: *none*. Output directory: *leave default*.
4. Deploy. You'll get a `something.vercel.app` URL — open it and confirm the site loads.

**Option B — Git (recommended for updates)**
1. Put these files in a Git repo (GitHub/GitLab/Bitbucket).
2. Vercel → **Add New → Project → Import** the repo.
3. Framework preset **Other**, no build command. Deploy.
4. Future changes: push to the repo and Vercel redeploys automatically.

`vercel.json` is picked up automatically — it redirects `www` → apex, adds
security headers (HSTS, X-Content-Type-Options, etc.), and caches the image/favicon.

---

## Part 3 — Connect joinlaunchory.com + DNS + HTTPS

1. In your Vercel project: **Settings → Domains → Add**.
2. Add **`joinlaunchory.com`** and click Add. Then add **`www.joinlaunchory.com`** too.
   Vercel will set the apex as primary and 308-redirect `www` → apex (matching `vercel.json`).
3. Vercel shows the DNS records to create. At your **domain registrar** (where you
   bought joinlaunchory.com), open DNS settings and add:

   | Type  | Name / Host | Value                       |
   |-------|-------------|-----------------------------|
   | A     | `@`         | `76.76.21.21`               |
   | CNAME | `www`       | `cname.vercel-dns.com`      |

   > Use the **exact values Vercel displays** for your project — the apex `A`
   > record IP is stable (`76.76.21.21`) but always confirm against Vercel's panel.
   > If your registrar supports it, you can instead point the whole domain's
   > **nameservers** to Vercel (Vercel → Domains → "Use Vercel nameservers"),
   > which is the most reliable option and lets Vercel manage everything.

4. **Remove** any conflicting old records (a parked-page A record, a default
   CNAME on `@` or `www`, etc.) so only the two above remain.
5. Wait for propagation (usually minutes, up to ~a few hours). Vercel's Domains
   page shows a green check when each domain is verified.
6. **HTTPS/SSL is automatic** — Vercel issues and renews a free Let's Encrypt
   certificate once DNS verifies. No action needed. Force-HTTPS is on by default,
   and `vercel.json` adds HSTS.

**When it's done, all four of these should load over `https://` with a valid lock:**
- `https://joinlaunchory.com`
- `https://www.joinlaunchory.com` → redirects to the apex
- `http://joinlaunchory.com` → redirects to `https://`
- `http://www.joinlaunchory.com` → redirects to `https://joinlaunchory.com`

---

## Part 4 — Analytics (optional but recommended)

The site loads analytics **only if you provide a key** (no key = nothing loads,
so it stays fast and privacy-clean until you're ready). Add either or both to the
`LAUNCHORY_CONFIG` block:

- **Google Analytics 4:** create a GA4 property, copy the Measurement ID
  (`G-XXXXXXXXXX`) into `GA_ID`.
- **PostHog:** create a project, copy the Project API key into `POSTHOG_KEY`
  (and set `POSTHOG_HOST` to your region's host).

The Early Access flow fires `early_access_submit` (with `role`) and
`early_access_duplicate` events automatically, so you can track sign-ups.

---

## Part 5 — When Launchory officially launches (future auth)

The Early Access flow is built to *become* your auth flow with minimal work:

- It already branches on **role** (`founder` / `creative`) and collects the
  identity fields you'll need for real accounts.
- Submissions go through **one function** (`submitAccess`) and **one table**
  (`early_access`), so swapping "insert an application" for "create a Supabase
  Auth user + profile row" is a localized change — not a rebuild.
- To open the product up later: point the two role cards at real sign-up, add
  Supabase Auth (magic link or OAuth), and drop the gate. Everything else in the
  app (the product, dashboards, flows) is already built and unchanged.

---

## Deployment checklist

- [ ] Supabase project created; `supabase-schema.sql` run successfully
- [ ] `early_access` table visible in Table Editor with RLS enabled
- [ ] `SUPABASE_URL` + `SUPABASE_ANON_KEY` pasted into `index.html`
- [ ] Deployed to Vercel; `*.vercel.app` URL loads correctly
- [ ] `joinlaunchory.com` and `www.joinlaunchory.com` added in Vercel → Domains
- [ ] DNS A (`@` → 76.76.21.21) and CNAME (`www` → cname.vercel-dns.com) set at registrar
- [ ] Old/conflicting DNS records removed
- [ ] Both domains show verified (green) in Vercel
- [ ] HTTPS valid on apex + www; http → https and www → apex redirects work
- [ ] `og-image.png`, `favicon.svg`, `robots.txt`, `sitemap.xml` reachable at the root

## Launch checklist

- [ ] Submit a **real founder** application → row appears in Supabase
- [ ] Submit a **real creative** application → row appears in Supabase
- [ ] Submit the **same email twice** → second attempt shows "You're already on the list"
- [ ] Submit with a **bad email / empty fields** → inline validation blocks it
- [ ] Share the link in Slack/iMessage/Twitter → OG image + title preview correctly
- [ ] Open on a phone → Early Access + the whole product feel right on mobile
- [ ] (If used) analytics is recording page views + `early_access_submit`
- [ ] Export emails from Supabase works (you can contact everyone)
- [ ] Register the site in **Google Search Console** and submit `sitemap.xml`
- [ ] Set `ADMIN`/service_role keys are **not** in the shipped `index.html` (only the anon key)
