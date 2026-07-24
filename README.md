# The Callsheet — Premium AI Artist Marketplace

The world's leading marketplace for professional AI artists and creators. Hire top talent for visual arts, motion design, and more with secure payments and legally binding contracts.

## 🚀 Key Features

- **Artist Spotlight** — Filter by skills, ratings, and roles.
- **Stripe Payments** — Secure payment processing with platform fee tracking.
- **E-Signatures** — Legally binding digital contracts with custom/standard terms.
- **Real-time Messaging** — Instant chat with typing indicators and notifications.
- **Analytics Dashboard** — Visual spend tracking, booking trends, and KPI cards.
- **Calendar Sync** — Google Calendar OAuth (two-way: push bookings, import busy blocks) plus .ics export.
- **Dispute Resolution** — Open disputes on bookings/contracts, upload evidence, admin mediation workflow.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Lucide Icons, Date-fns, Socket.io-client.
- **Backend**: Express (Node.js), Socket.io, Stripe SDK, Zod, Helmet.
- **Persistence**: Supabase (PostgreSQL) with in-memory fallback.
- **Security**: Rate limiting, security headers, and input validation.

## 📦 Setup & Development

### 1. Prerequisites
- Node.js 20+
- Stripe Account (for payments)
- Supabase Project (for persistence)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/the-callsheet.git
cd the-callsheet

# Install dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the root:
```env
# API Config
API_PORT=3001
FRONTEND_URL=http://localhost:5173

# Stripe (required for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (optional — Resend for transactional alerts)
RESEND_API_KEY=re_...
EMAIL_FROM=The Callsheet <notifications@yourdomain.com>

# Supabase (required for persistence)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Calendar OAuth (optional — two-way sync for artists)
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
# Defaults to {FRONTEND_URL}/api/calendar/callback if unset
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3001/api/calendar/callback
```

### 4. Running Locally
```bash
# Start both frontend and backend
npm run dev
```

## 🚢 Deployment

### Dual runtime (important)

| Host | Role |
|------|------|
| **Vercel** | **Production** — static frontend + `/api/*` serverless functions |
| **Express** (`server/index.js`) | **Local / optional** — same `api/_lib/*` logic + Socket.io; not required for money flows |

Keep env parity: the same Stripe + Supabase secrets must exist on Vercel Production. If you still run Express on Railway, mirror those vars there too.

```bash
npm run check:env          # verify local required vars (no secret values printed)
vercel env pull .env.local --environment=production --yes
# then set FRONTEND_URL=http://localhost:5173 for local Express redirects
```

`FRONTEND_URL`:
- Vercel Production → `https://www.thecallsheet.ai`
- Local Express → `http://localhost:5173`

### Vercel (recommended — frontend + serverless API)
The project includes a `vercel.json` config. API routes live under `/api/*` as Vercel Functions.

1. Connect your repo to Vercel.
2. Set environment variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL=https://www.thecallsheet.ai`
   - `RESEND_API_KEY`, `EMAIL_FROM` (optional, for email alerts)
   - `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` (optional)
3. Run SQL migrations in order (`supabase/MIGRATIONS.md`), including `contract-signature-audit.sql` and `employer-tax-vault.sql`.
4. Deploy.

### Local full-stack (optional)
```bash
npm run dev   # Vite + Express/Socket.io on :3001
```

For confirmed bookings created before contract auto-linking:
```bash
npm run backfill:contracts
```

---
© 2026 The Callsheet. All rights reserved.
