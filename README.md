# Breakfast Club — Orders Portal
## Deployment Guide

### 1. Prerequisites
- Node.js 18+ 
- Supabase project with schema from `query.sql` applied
- Razorpay account (live keys)
- WhatsApp API provider (Gupshup, AiSensy, Interakt, or similar)

---

### 2. Install Dependencies

```bash
npm install
npm install @supabase/supabase-js razorpay
```

---

### 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase → Settings → API (keep secret!)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — from Razorpay Dashboard
- `RAZORPAY_KEY_SECRET` — from Razorpay Dashboard (keep secret!)
- `WHATSAPP_API_URL` + `WHATSAPP_API_TOKEN` — from your WhatsApp provider

---

### 4. WhatsApp OTP Setup

The `app/api/auth/send-otp/route.ts` calls your WhatsApp provider.
Update the payload format to match your provider's API:

**Gupshup example:**
```js
body: JSON.stringify({
  channel: 'whatsapp',
  source: 'YOUR_GUPSHUP_NUMBER',
  destination: normalizedPhone,
  message: { type: 'text', text: `Your OTP: ${otp}` },
  'src.name': 'BreakfastClub',
})
```

**AiSensy / Interakt:** Update similarly per their docs.

---

### 5. Run Locally

```bash
npm run dev
# Visit http://localhost:3000/orders
```

---

### 6. Deploy to Vercel

```bash
npx vercel --prod
```

Or connect your GitHub repo to Vercel and add environment variables in:
**Vercel → Project → Settings → Environment Variables**

Set the same variables from `.env.local`.

**Important:** Set your custom domain `breakfastclub.co.in` in Vercel → Domains.

---

### 7. Supabase Row Level Security (RLS)

Recommended RLS policies for production:

```sql
-- Allow service role to read/write everything (for API routes)
-- Anon role should NOT have access to orders directly

-- portal_sessions: anon can insert but not read others
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;

-- otp_codes: service role only
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
```

---

### 8. File Structure

```
app/
  layout.tsx               # Root layout with Razorpay script
  globals.css              # Design system + utility classes
  orders/
    page.tsx               # Full orders portal (login → OTP → dashboard)
  api/
    auth/
      send-otp/route.ts    # WhatsApp OTP sender
      verify-otp/route.ts  # OTP verifier + session creator
    orders/route.ts         # Orders fetcher (cache + relational)
    return/route.ts         # Return request submission
    replacement/route.ts    # Replacement + Razorpay order creation
lib/
  supabase.ts              # Supabase client + TypeScript types
.env.example               # Environment variable template
```

---

### 9. Customization

- **Brand colors:** Edit `--color-primary` in `globals.css`
- **Return window:** Change `<= 3` in `daysSince` check in `page.tsx` (search `canReturn`)
- **Cancellation:** Wire `app/api/orders/[id]/cancel/route.ts` to Shopify API
- **Products for replacement:** The `ReplaceModal` accepts `allProducts` prop — fetch from `/api/products` or your Supabase products table and pass it in

---

### 10. Common Issues

| Issue | Fix |
|---|---|
| OTP not received | Check WhatsApp API token + URL in `.env.local` |
| Orders not loading | Verify `orders_cache` table has phone column with correct format |
| Razorpay popup not opening | Check `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set and not using test key in prod |
| CORS errors | Add your domain to Supabase → Settings → API → CORS |
