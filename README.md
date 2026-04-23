# Second Unit — Premium AI Artist Marketplace

The world's leading marketplace for professional AI artists and creators. Hire top talent for visual arts, motion design, and more with secure payments and legally binding contracts.

## 🚀 Key Features

- **Artist Leaderboard** — Filter by skills, ratings, and roles.
- **Stripe Payments** — Secure payment processing with platform fee tracking.
- **E-Signatures** — Legally binding digital contracts with custom/standard terms.
- **Real-time Messaging** — Instant chat with typing indicators and notifications.
- **Analytics Dashboard** — Visual spend tracking, booking trends, and KPI cards.
- **Calendar Sync** — Export bookings to Google Calendar or download .ics files.

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
git clone https://github.com/your-username/second-unit.git
cd second-unit

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

# Supabase (required for persistence)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Running Locally
```bash
# Start both frontend and backend
npm run dev
```

## 🚢 Deployment

### Frontend (Vercel)
The project includes a `vercel.json` config.
1. Connect your repo to Vercel.
2. Set Environment Variables in Vercel dashboard.
3. Deploy!

### Backend (Railway/Docker)
The project includes a `Dockerfile` for the API server.
1. Create a new service on Railway.
2. Connect your repo (Railway detects the Dockerfile).
3. Set Environment Variables.
4. Set the internal port to `3001`.

---
© 2026 Second Unit. All rights reserved.
