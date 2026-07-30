# Volunteerly

A platform connecting students with nonprofits for discoverable, joinable, and digitally verified volunteer work.

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the app runs entirely on realistic mock data out of the box (see `NEXT_PUBLIC_USE_MOCK_DATA` in `.env.example`), so you can click through every flow with no backend setup.

**Demo accounts** (use the "Demo accounts" shortcuts on the login page):
- Student: Maya Chen — maya.chen@student.edu
- Organization: Coastal Paws Animal Rescue — hello@coastalpaws.org
- Admin: admin@volunteerly.app

## Going live with a real backend

1. Create a project at supabase.com
2. In the SQL Editor, run `supabase/schema.sql` (creates every table + row-level security policy)
3. Copy `.env.example` to `.env.local` and fill in your Supabase URL/keys
4. Set `NEXT_PUBLIC_USE_MOCK_DATA=false`
5. Deploy to Vercel (vercel.com → Add New Project → import this repo), pasting the same env vars in

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Stripe (scaffolded) · Vercel

## Project structure

- `src/app` — routes (App Router)
- `src/components` — UI, landing sections, dashboard widgets
- `src/lib/types.ts` — domain model, mirrors the DB schema exactly
- `src/lib/context/data-context.tsx` — mock data store + business logic (join/verify/check-in). Swap this file's internals for real Supabase queries when you're ready to go live — every other file calls through it, so nothing else needs to change.
- `supabase/schema.sql` — production Postgres schema + RLS policies
