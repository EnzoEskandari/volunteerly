# Volunteerly

A platform connecting students with nonprofit organizations. Students discover
volunteer opportunities that match their interests and schedule, join instantly,
check in by QR code, and receive digitally verified service hours from the
organization — a permanent, scholarship-ready record.

Built with Next.js 14 (App Router), Supabase (Postgres + Auth), Stripe, and
Tailwind CSS.

---

## Setup

The app talks to a real, shared, multi-user database. There is no mock or
offline mode, so it will not run until Supabase credentials are configured.

### 1. Install

```bash
npm install
```

### 2. Create the database

Create a project at [supabase.com](https://supabase.com), then open the SQL
Editor and run the entire contents of [`supabase/schema.sql`](supabase/schema.sql).

That one file creates every table, all row-level-security policies, the column
guards that keep membership and verified hours out of users' hands, and the
trigger that provisions a profile when someone registers.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in, from **Supabase → Project Settings → API**:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **server-only, never expose** |

### 4. Enable Google Sign-In (optional)

In **Supabase → Authentication → Providers → Google**, add your Google OAuth
client ID and secret, and add `<your-site>/auth/callback` as an authorized
redirect URL.

### 5. Configure Stripe

Students pay a small annual membership; organizations are never charged.

1. Add your `STRIPE_SECRET_KEY` to `.env.local`.
2. Optionally create a recurring Price in the Stripe dashboard and set
   `STRIPE_MEMBERSHIP_PRICE_ID`. Without it, an inline price is built from
   `NEXT_PUBLIC_MEMBERSHIP_PRICE_CENTS`.
3. Forward webhooks while developing, and put the printed signing secret in
   `STRIPE_WEBHOOK_SECRET`:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

In production, add the same endpoint in the Stripe dashboard and subscribe it
to `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.updated` and `customer.subscription.deleted`.

**Membership is granted only by the verified webhook.** Completing checkout in
the browser does not itself grant access.

### 6. Create the first administrator

Admin accounts are not reachable through public registration — the sign-up
trigger clamps any requested role to `student` or `organization`. To promote an
existing account, run this in the SQL editor:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
insert into admins (id, full_name)
select id, 'Your Name' from profiles where email = 'you@example.com';
```

### 7. Run

```bash
npm run dev
```

---

## Architecture

### Where trust lives

Row-level security is the access boundary, not the UI. The rule throughout: if
a user could benefit from lying about something, the browser doesn't get to
write it.

| Action | Enforced by | Why not client-side |
| --- | --- | --- |
| Joining an opportunity | `POST /api/opportunities/join` | Checks membership, capacity, age and certifications. Capacity is claimed by a conditional update, so two students can't take the same last seat. |
| QR check-in | `POST /api/checkin` | Students have **no read access** to `qr_tokens`. Without that, anyone could list every code and check in to events they never attended. |
| Verifying hours | `POST /api/hours/verify` | Only the hosting org, only for a student who actually checked in. The record is then immutable. |
| Membership status | `POST /api/stripe/webhook` | Set from Stripe's signed event, after money actually moves. |
| Fee waivers | `POST /api/admin/waiver` | Only an admin can grant one. |
| Org approval | `POST /api/admin/organizations` | Admin-only; suspension also pulls the org's listings from discovery. |

Reads are scoped by intent — "my registrations", "this org's roster" — and RLS
enforces that independently of what the client asks for.

### Verified hours are permanent

Spec requirement, enforced three ways: no `UPDATE`/`DELETE` policy exists on
`verified_hours`, a trigger raises on either, and no client-side write path
exists. Corrections are made by issuing a new entry. A student's running total
is recomputed by trigger from the underlying rows, so it can't drift.

Because those records must survive, deleting an organization that has issued
verified hours is refused — suspend it instead.

### No fabricated content

Platform statistics are counted from the database. When the platform is new
they are genuinely zero, and the landing page's stats section renders nothing
at all rather than showing an invented figure. There are no seeded users, no
demo logins, and no testimonials.

---

## Project layout

```
src/
  app/
    api/                  server-validated actions (the trust boundary)
    dashboard/            student · nonprofit · admin
    opportunities/        public discovery feed
  components/
  lib/
    supabase/             queries.ts is the only place that knows SQL columns
    achievements.ts       badge catalog (product config, not user data)
    pricing.ts            membership price — configurable, never hardcoded
supabase/
  schema.sql              tables, RLS policies, triggers
```

## Deploying

Deploys to Vercel as-is. Set every variable from `.env.example` in the project's
environment settings, set `NEXT_PUBLIC_SITE_URL` to the real origin, and add the
Stripe webhook endpoint. Page analytics are wired via `@vercel/analytics`.
