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
- `app/login` — "Sign in with Google" (Supabase OAuth).
- `app/auth/callback` — exchanges the Google OAuth code for a session and
  redirects to `/dashboard`.

## Business logic recap

- **Pump Truth** = `trip_distance_km / pumped_liters` (DB-generated column).
- **True Reserve** = `35 (tank capacity L) - pumped_liters` (DB-generated
  column).
- **Net Cost**: Pazomat → `full_price_paid - 0.58 * pumped_liters`; Credit
  Card → `full_price_paid` (DB-generated column, mirrored in
  `lib/billing.ts` for the widget breakdown).
- **Upcoming Bill**: sum of Net Cost for every Pazomat transaction whose
  `entry_date` falls exactly two calendar months before the current month
  (fuel pumped in June is billed in August).

If the tank capacity or discount rate ever changes, update both the SQL
migration comments/generated columns and the constants at the top of
`lib/billing.ts` — they're intentionally kept in sync rather than sourced
from one place, since this is a single fixed vehicle.

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
- Consider a `vehicles` table if you ever track more than one car — right
  now the 35 L tank capacity is intentionally hardcoded for the Picanto.
