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
2. In the **SQL Editor**, run migrations in order: `001_initial.sql` through `006_r2_storage.sql`
3. This creates all tables, RLS policies, and seeds 33 hotels, 4 airlines, and default settings

### 2. Configure Environment Variables

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare R2 — PDF storage for custom invoices & hotel vouchers
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=umrah-dashboard-files

# Direct Postgres — required for custom invoices & hotel vouchers (bypasses Supabase Data API)
# Supabase → Settings → Database → Connection string → URI (Transaction pooler, port 6543)
DATABASE_URL=postgresql://postgres.rvucrtiahhuadbezhnbs:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

Find Supabase keys in your project: **Settings → API**

Create an R2 bucket in Cloudflare (**R2 → Create bucket**), then generate an API token scoped to that bucket only. R2 requires a card on file but stays free under 10 GB/month.

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
