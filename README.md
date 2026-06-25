# Fast Travels Umrah CRM — Next.js

A modern, fast Umrah package management CRM built with Next.js 16, Supabase, and Tailwind CSS. Deployable on Netlify.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, React Server Components)
- **Database:** Supabase (PostgreSQL + Auth)
- **UI:** Tailwind CSS + shadcn/ui
- **Hosting:** Netlify

---     

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free project
2. In the **SQL Editor**, run the entire contents of `supabase/migrations/001_initial.sql`
3. This creates all tables, RLS policies, and seeds 33 hotels, 4 airlines, and default settings

### 2. Configure Environment Variables

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Find these in your Supabase project: **Settings → API**

### 3. Create Your First Admin User

In **Supabase Dashboard → Authentication → Users**, click "Add user":
- Email: `admin@fasttravels.pk`
- Password: your choice

Then in the **SQL Editor**, link the user to `staff_users`:

```sql
INSERT INTO staff_users (id, name, username, role, permission, status)
SELECT id, 'Admin', 'admin', 'Admin', 'Full Access', 'Active'
FROM auth.users WHERE email = 'admin@fasttravels.pk';
```

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Netlify

1. Push this folder to a GitHub repository
2. In Netlify: **Add new site → Import from Git**
3. Set build command: `npm run build`
4. Set publish directory: `.next`
5. Add environment variables (same as `.env.local`) in **Site settings → Environment variables**
6. Deploy

The `netlify.toml` and `@netlify/plugin-nextjs` handle everything automatically.

---

## Features

| Module | Description |
|---|---|
| Dashboard | KPI cards, recent bookings, quick links |
| Umrah Calculator | Live package builder with cost breakdown, WhatsApp copy, print invoice |
| Bookings | Full booking list with search and delete |
| Customers | Customer records derived from bookings |
| Invoices | Invoice list with status |
| Accounts | Payment recording, KPIs, payment history |
| Reports | Revenue / Cost / Profit with airline breakdown |
| Settings | Visa rates, airlines, transport, hotels, currency, company info |
| Users & Staff | Staff CRUD with real Supabase Auth accounts |
