# Fuelizer

Fuel tracking, telemetry analysis, and billing for a Kia Picanto. Next.js (App
Router) + Supabase (Postgres, Auth, Storage), deployed on Vercel.

## What's here

- `supabase/migrations/0001_init_schema.sql` — the `fuel_cycles` table, RLS
  policies, and the `receipts` Storage bucket.
- `supabase/migrations/0002_harden_security.sql` — closes a real hole in
  `v_billing_cycles` (it defaulted to `SECURITY DEFINER`, which bypasses
  `fuel_cycles`' RLS and would let any signed-in user read everyone's fuel
  data through the view) and pins the trigger function's `search_path`.
- `supabase/migrations/0003_add_dashboard_image.sql` — adds
  `dashboard_image_path`, so the Lab scanner's dashboard photo has a column
  to live in alongside `receipt_image_path` instead of just sitting
  unreferenced in Storage.
- `supabase/migrations/0004_user_settings.sql` — a `user_settings` table
  (Pazomat discount, tank capacity) editable from `/settings`.
- `supabase/migrations/0005_add_estimated_range.sql` — adds
  `estimated_range` (km, nullable) to `fuel_cycles`. The Lab scanner
  auto-calculates an initial value from the car computer's average
  consumption and lets the user override it before saving.
- `supabase/migrations/0006_decouple_calculations.sql` — turns
  `net_cost_ils` and `true_reserve_liters` from hardcoded-constant
  DB-generated columns into plain nullable columns. `app/lab/actions.ts`
  now computes and snapshots both at insert time from that user's actual
  `user_settings` row (falling back to the same 0.58 / 35L defaults if
  they haven't saved one), so a later change to `user_settings` never
  retroactively rewrites a past fill-up's numbers. See Business logic
  recap below.
- `lib/billing.ts` — the 2-month time-shift billing logic and Pazomat
  discount math (`calculateUpcomingBill`, `calculateNetCost`), with tests in
  `lib/billing.test.ts`.
- `app/dashboard` — Upcoming Bill widget, Current Cycle Status, and a
  Computer-vs-Pump-Truth consumption chart.
- `app/lab` — camera-first fill-up entry: `components/lab/receipt-scanner.tsx`
  captures a receipt photo and a dashboard photo, uploads both to Storage,
  and calls `actions/ocr.ts` (a Together AI vision model, given both images
  in one request) to auto-fill an editable confirmation card before a
  server action inserts into `fuel_cycles` — receipt and dashboard paths
  both recorded on the row.
- `app/history` — every fill-up as a card (date, distance/odometer, Pump
  Truth vs. car computer, net cost, payment method), with tap-to-enlarge
  receipt/dashboard thumbnails (signed Storage URLs, generated server-side
  since the bucket is private) and a delete action that also cleans up the
  Storage objects it referenced.
- `app/settings` — Pazomat discount / tank capacity form (upserts
  `user_settings`) and a sign-out button.
- `app/login` — "Sign in with Google" (Supabase OAuth).
- `app/auth/callback` — exchanges the Google OAuth code for a session and
  redirects to `/dashboard`.
- `app/manifest.ts`, `app/icon.png`/`apple-icon.png`, `public/sw.js` — PWA
  install support. See PWA setup below for why this is a hand-written
  service worker rather than a plugin.
- `app/{dashboard,history,lab}/loading.tsx` — instant skeleton shells
  Next.js streams in during navigation while each page's Supabase fetch is
  still in flight. See Navigation performance below.

## Business logic recap

- **Pump Truth** = `trip_distance_km / pumped_liters` (DB-generated column
  — still hardcoded-free since it has no discount/capacity constant in it).
- **True Reserve** = `tank_capacity_liters - pumped_liters`, using that
  user's `user_settings.tank_capacity_liters` (falls back to 35L if they
  haven't saved a settings row). Computed server-side in
  `app/lab/actions.ts` and snapshotted onto `fuel_cycles.true_reserve_liters`
  at insert time — no longer a DB-generated column as of
  `0006_decouple_calculations.sql`.
- **Net Cost**: Pazomat → `full_price_paid - pazomat_discount_per_liter *
  pumped_liters`, using that user's `user_settings.pazomat_discount_per_liter`
  (falls back to 0.58 ILS/L); Credit Card → `full_price_paid` unchanged.
  Same deal — computed server-side in `app/lab/actions.ts` and snapshotted
  onto `fuel_cycles.net_cost_ils` at insert time, not DB-generated anymore.
- **Estimated Range**: `fuel_cycles.estimated_range` (km) — a plain,
  always-user-editable column. The Lab scanner pre-fills it with
  `round(tank_capacity_liters * computer_avg_consumption_kml)` when the OCR
  found a computer consumption figure, shown with a small "חושב אוטומטית –
  ניתן לערוך" hint, but it's never recomputed server-side and the user can
  freely overwrite it before saving.
- **Upcoming Bill**: sum of Net Cost for every Pazomat transaction whose
  `entry_date` falls exactly two calendar months before the current month
  (fuel pumped in June is billed in August).

Net Cost and True Reserve are snapshotted per-row from the user's *actual*
settings at fill-up time (`app/lab/actions.ts`), and the Dashboard's
Upcoming Bill widget now reads that same live rate too: `lib/billing.ts` no
longer hardcodes a discount at all — `calculateNetCost` and
`calculateUpcomingBill` take `pazomatDiscountPerLiter` as a parameter, and
`app/dashboard/page.tsx` fetches it from that user's `user_settings` row
(falling back to `DEFAULT_PAZOMAT_DISCOUNT_PER_LITER` from
`lib/settings.ts` if they haven't saved one) before calling either
function. `app/lab/actions.ts` calls the same `calculateNetCost` rather
than duplicating the formula, so the Pazomat-only-discount rule now lives
in exactly one place. `DEFAULT_PAZOMAT_DISCOUNT_PER_LITER` /
`DEFAULT_TANK_CAPACITY_LITERS` in `lib/settings.ts` remain the single
source of truth for the fallback values shown before a user has ever saved
`/settings`.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com), or
   run the stack locally with the [Supabase CLI](https://supabase.com/docs/guides/local-development):

   ```bash
   npx supabase init      # only if you haven't already (config.toml is included)
   npx supabase start
   ```

3. **Apply the schema**

   - Local stack: `npx supabase db reset` (applies everything in
     `supabase/migrations/`).
   - Hosted project: `npx supabase link --project-ref <your-ref>` then
     `npx supabase db push`.

4. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   from the Supabase dashboard (Project Settings → API), or from
   `npx supabase status` for the local stack.

5. **Run the app**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`, sign in with Google (see setup below),
   then log a fill-up at `/lab` and check `/dashboard`.

6. **Run the billing logic tests**

   ```bash
   npm test
   ```

## Google OAuth setup

The Supabase Auth server is the OAuth client as far as Google is concerned —
Google redirects back to **Supabase**, not to Next.js, so the redirect URI
you register in Google Cloud is your Supabase project's URL, not Vercel's or
`localhost`.

**1. Google Cloud Console — OAuth consent screen**

- [console.cloud.google.com](https://console.cloud.google.com) → select/create a project.
- APIs & Services → OAuth consent screen → User Type **External** → Create.
- Fill in app name, support email, developer contact email.
- Scopes: the defaults (`userinfo.email`, `userinfo.profile`, `openid`) are enough — don't add more.
- Add your own Google account under **Test users** if the app is left in "Testing" mode (fine for development; publish to production when you're ready for any Google account to sign in).

**2. Google Cloud Console — Credentials**

- APIs & Services → Credentials → Create Credentials → **OAuth client ID**.
- Application type: **Web application**.
- **Authorized redirect URIs** — add exactly:

  ```
  https://<your-project-ref>.supabase.co/auth/v1/callback
  ```

  For this project that's:

  ```
  https://laspuwihkuhdketnanvs.supabase.co/auth/v1/callback
  ```

  This is fixed and always ends in `/auth/v1/callback` — it is **not** your
  app's `/auth/callback` route (that's a separate, later hop that never
  touches Google directly). Don't add `localhost` or your Vercel URL here;
  Supabase is the only thing Google ever redirects to.
- Save, then copy the generated **Client ID** and **Client Secret**.

**3. Supabase Dashboard**

- Your project → Authentication → Sign In / Providers → **Google** → enable it.
- Paste the **Client ID** and **Client Secret** from step 2, then Save.
- Authentication → URL Configuration:
  - **Site URL**: your production URL (e.g. `https://fuelizer.vercel.app`).
  - **Redirect URLs**: add `https://fuelizer.vercel.app/**` (and
    `http://localhost:3000/**` for local dev) so Supabase is allowed to send
    the browser back to `/auth/callback` on each of those origins.

**4. Local development only**

If you're running the Supabase CLI locally (`supabase start`), the local
Auth server proxies Google OAuth itself and needs the same Client ID/Secret
as env vars — see `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` /
`_SECRET` in `.env.example` and `[auth.external.google]` in
`supabase/config.toml`. Hosted Supabase projects don't need these env vars —
the credentials live in the dashboard (step 3).

## Receipt OCR setup

The Lab route sends a downscaled photo to a vision-language model on
[Together AI](https://together.ai) (OpenAI-compatible, priced by the token)
to auto-fill the fill-up form. This runs entirely server-side in
`actions/ocr.ts`, so the API key never reaches the browser.

- Create a Together AI account and API key at
  [api.together.ai/settings/api-keys](https://api.together.ai/settings/api-keys).
- Add `TOGETHER_API_KEY` to `.env.local` for local dev, and as a Vercel
  project environment variable for production (see Deploying below).
- No Supabase-side configuration needed — the OCR call and the Storage
  upload are independent; if the model call fails, the photo you already
  took is still uploaded, and the confirmation card just opens blank for
  manual entry instead of failing the whole flow.

**Which model, and why it might need changing:** Together AI periodically
moves models between its pay-per-token "serverless" pool and paid
dedicated-endpoint-only tiers. `actions/ocr.ts` defaults to
`Qwen/Qwen3.5-9B`, but if OCR starts failing, check the Vercel runtime logs
for an error like:

```
Together AI returned an error: 400 { "error": { "code": "model_not_available", "message": "Unable to access non-serverless model ..." } }
```

That means the current default has moved off the serverless tier. Fix it
without touching code: open your Together dashboard's
[Models page](https://api.together.ai/models), filter to Vision +
Serverless, pick one, and set it as `TOGETHER_VISION_MODEL` in Vercel's
project environment variables, then redeploy.

## Navigation performance

`/dashboard`, `/history`, and `/lab` are all Server Components that block on
a Supabase query before rendering anything — without a `loading.tsx`
sibling, Next.js has no static shell to show, so a tap on the bottom nav
just... sits there until the fetch resolves. Two things fix that together,
not either alone:

- **`loading.tsx` in each of those three route folders.** Next
  automatically wraps the route's `page.tsx` in a `<Suspense
  fallback={<Loading />}>` boundary whenever a sibling `loading.tsx`
  exists — no code changes needed in the pages themselves. The skeletons
  (`components/ui/skeleton.tsx`, a plain `animate-pulse` block) mirror each
  page's real layout so the swap-in doesn't jump around.
- **This is also what makes `<Link>` prefetching actually pay off** for
  these pages. They're dynamic (server-rendered per request via
  `cookies()`), so Next can't prefetch their real content ahead of a click
  — but once a route has a `loading.tsx`, that static shell itself becomes
  prefetchable, so it's often already in the client cache by the time you
  tap the tab. `components/nav/bottom-nav.tsx` already used `<Link
  href={...}>` correctly (static hrefs, no `prefetch={false}`) — nothing
  needed to change there; it just had nothing worth prefetching until now.
- `components/history/fuel-cycle-card.tsx`'s thumbnails already used
  `next/image` with `fill` + explicit `sizes` inside fixed-size containers
  (`h-10 w-10`, `aspect-square`) and no `priority`, so they were already
  correctly lazy-loaded and CLS-safe — also nothing to change there.

## PWA setup

**A finding worth knowing before you touch this again:** this project
builds with **Turbopack** (Next 16's default bundler — no `--webpack` flag
anywhere in `package.json`), and Turbopack does not run webpack plugins at
all. `@ducanh2912/next-pwa` works by injecting Workbox's webpack plugins
into a `webpack()` config — under Turbopack that config is not just
ignored, `next build` hard-errors ("This build is using Turbopack, with a
`webpack` config and no `turbopack` config"). Confirmed by actually
installing it and running the build, not just reading about the
incompatibility. So instead of that plugin:

- `app/manifest.ts` — the standard Next.js file convention; auto-served at
  `/manifest.webmanifest` (also referenced explicitly via
  `metadata.manifest` in `app/layout.tsx`, since the file-convention
  auto-linking behavior wasn't unambiguous in this exact Next version's
  docs — cheap to be explicit rather than assume).
- `app/icon.png` / `app/apple-icon.png` — the Next file convention for the
  browser-tab favicon and iOS home-screen bookmark icon; Next generates the
  `<link>` tags automatically.
- `public/sw.js` — a **hand-written** service worker, not build-generated.
  Turbopack has no hook to inject a precache manifest of hashed asset URLs
  at build time (that's specifically what the webpack-plugin approach
  automates), so this uses runtime caching instead: Next's immutable
  `/_next/static/*` assets are cache-first, page navigations are
  network-first falling back to the last cached copy of that page, and
  `/offline` is the final fallback when neither is available.
  `components/pwa/register-service-worker.tsx` registers it, production
  builds only (a service worker intercepting fetches in dev would fight
  Turbopack's Fast Refresh). `next.config.mjs` sets
  `Cache-Control: no-cache` on `/sw.js` specifically — without that,
  browsers/CDNs can cache the worker file itself and a logic update never
  reaches returning users.
- `app/layout.tsx` exports `viewport` (separately from `metadata`, as
  required since Next 14) with `themeColor` and `viewportFit: "cover"` —
  the latter isn't just PWA polish, it's required for
  `env(safe-area-inset-bottom)` to resolve to anything other than `0` on
  notched iPhones, which `components/nav/bottom-nav.tsx` already depends
  on. `metadata.appleWebApp = { capable: true, ... }` is also set; verified
  in an actual rendered page that this Next version emits the modern,
  cross-browser `<meta name="mobile-web-app-capable">` tag rather than the
  legacy Apple-prefixed one — which is the current correct behavior, not a
  bug, so don't "fix" it back.

All of the above was verified against a real production build+start, not
just assumed from the code: `/manifest.webmanifest` and `/sw.js` serve the
expected content and headers, the rendered `<head>` has the right
`<link>`/`<meta>` tags, and `navigator.serviceWorker.getRegistration()`
came back `{ active: true }`.

**Icons.** `public/icon-192x192.png`, `icon-512x512.png`, and
`icon-maskable-512x512.png` (referenced by the manifest) plus
`app/icon.png` and `app/apple-icon.png` (the favicon/apple-touch-icon
convention files) already exist — a simple on-brand placeholder (white
droplet on the app's `#3c83f6` primary blue, generated from an SVG via
`sharp`, no external design tool needed) so the app is installable right
now rather than blocked on artwork. Swap in real branding whenever you
have it, matching this checklist:

| File | Size | Notes |
| --- | --- | --- |
| `public/icon-192x192.png` | 192×192 | Manifest `"any"` icon |
| `public/icon-512x512.png` | 512×512 | Manifest `"any"` icon |
| `public/icon-maskable-512x512.png` | 512×512 | Manifest `"maskable"` icon — keep the important content inside the center ~66% (Android crops the rest into various shapes) |
| `app/icon.png` | 512×512 (or any square ≥192px) | Browser-tab favicon / PWA home-screen icon |
| `app/apple-icon.png` | 180×180 | iOS home-screen bookmark icon — opaque background, no transparency (iOS ignores alpha and rounds the corners itself) |

## Deploying

- Push this repo to GitHub and import it into [Vercel](https://vercel.com).
- **Required**: add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  and `TOGETHER_API_KEY` as Vercel project environment variables (Project
  Settings → Environment Variables, for the Production environment at
  minimum). Without the first two the app throws
  `Your project's URL and Key are required to create a Supabase client!`
  on every request and every route 500s; without `TOGETHER_API_KEY` the
  Lab's photo scan still uploads the receipt but OCR fails and the
  confirmation card opens blank. Vercel doesn't read
  `.env.example`/`.env.local`, so this step doesn't happen automatically.
- Make sure Supabase Auth → URL Configuration has your Vercel URL in Site
  URL and Redirect URLs (see the Google OAuth setup above) — otherwise
  `/auth/callback` gets rejected after the Google redirect.
- After setting the env vars, redeploy (or just retry — Vercel picks up new
  env vars on the next build/deployment, not on already-running ones).

## Next steps

- Add a car-computer-vs-pump-truth delta stat and a liters-per-100km toggle
  next to the existing km/L chart.
- Consider a `vehicles` table if you ever track more than one car.
