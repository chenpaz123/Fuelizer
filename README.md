# Fuelizer

Fuel tracking, telemetry analysis, and billing for a Kia Picanto. Next.js (App
Router) + Supabase (Postgres, Auth, Storage), deployed on Vercel.

## What's here

- `supabase/migrations/0001_init_schema.sql` — the `fuel_cycles` table, RLS
  policies, and the `receipts` Storage bucket.
- `lib/billing.ts` — the 2-month time-shift billing logic and Pazomat
  discount math (`calculateUpcomingBill`, `calculateNetCost`), with tests in
  `lib/billing.test.ts`.
- `app/dashboard` — Upcoming Bill widget, Current Cycle Status, and a
  Computer-vs-Pump-Truth consumption chart.
- `app/lab` — manual telemetry entry form (a server action inserts into
  `fuel_cycles`).
- `app/login` — Supabase magic-link auth.

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

   Visit `http://localhost:3000`, sign in via the magic link sent to your
   email, then log a fill-up at `/lab` and check `/dashboard`.

6. **Run the billing logic tests**

   ```bash
   npm test
   ```

## Deploying

- Push this repo to GitHub and import it into [Vercel](https://vercel.com).
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
  Vercel project environment variables.
- Add your Vercel deployment URL to Supabase Auth → URL Configuration
  (Site URL + Redirect URLs) so magic links work in production.

## Next steps

- Wire up receipt photo upload to the `receipts` Storage bucket from the Lab
  form (path convention: `<user_id>/<entry_date>.jpg`), as a stepping stone
  toward OCR auto-fill.
- Add a car-computer-vs-pump-truth delta stat and a liters-per-100km toggle
  next to the existing km/L chart.
- Consider a `vehicles` table if you ever track more than one car — right
  now the 35 L tank capacity is intentionally hardcoded for the Picanto.
