# Sattvaa Batters Production App

This is a real-time inventory and production management frontend for Batters Production LLC.

## Setup

1. Copy `web/.env.example` to `web/.env`.
2. Set your Supabase credentials:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. From `batters-production/web`, run:
   ```bash
   npm install
   npm run dev
   ```

## Features

- Live inventory table from Supabase
- Inline quantity editing with save-on-blur and Enter support
- Real-time sync using Supabase realtime subscriptions
- Add new inventory items
- Simple, responsive dashboard layout

## Deployment

Recommended hosting:

- Vercel (free tier)
- Netlify

### Vercel steps

1. Push this repository to GitHub.
2. Create a Vercel project and point it at the repository.
3. Set the following environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Use the default build command:
   ```bash
   npm run build
   ```
5. Deploy.

## Notes

- This app expects a Supabase table named `inventory_items` with the schema defined in `supabase/migrations/001_schema.sql`.
- Realtime updates are handled by the `useRealtimeInventory` hook.
