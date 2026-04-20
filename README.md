# Duty Scheduler (Supabase + Vercel)

Simple starter app for online manual scheduling with 3 fixed shifts:
- Morning
- Afternoon
- Night

The stack is completely free to start:
- Next.js app hosted on Vercel
- Supabase Postgres database + REST API

## 1) Create a Supabase project

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. In Supabase, open the SQL editor.
3. Run the SQL from `supabase/schema.sql`.

This creates the `schedules` table and policies needed by this starter.

## 2) Configure environment variables

1. Copy `.env.example` to `.env.local`.
2. In Supabase, open **Project Settings -> API**.
3. Copy:
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 3) Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4) Deploy to Vercel

1. Push this project to GitHub.
2. In [Vercel](https://vercel.com/), import the GitHub repository.
3. In Vercel project settings, add the same environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## How this starter works

- `app/page.tsx`: Manual scheduler UI for one day with 3 shifts.
- `app/api/schedules/route.ts`: Reads and saves shift assignments.
- `lib/supabase.ts`: Shared Supabase client.
- `supabase/schema.sql`: Database schema + RLS policies.

## Notes for next upgrades

- Add authentication (Supabase Auth) so only staff can edit schedules.
- Add weekly/monthly calendar views.
- Add role-based permissions (manager vs viewer).
