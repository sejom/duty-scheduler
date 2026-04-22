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

This creates tenant-aware tables and policies:
- `organizations` (hospitals)
- `organization_members` (who belongs to which hospital)
- `schedules` scoped by `organization_id`

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

## 3.1) Add yourself to a hospital tenant

After creating an auth user in Supabase, insert at least one organization membership.

Example SQL (replace placeholders):

```sql
insert into public.organizations (name)
values ('Hospital A')
on conflict (name) do nothing;

insert into public.organization_members (organization_id, user_id, role)
select o.id, u.id, 'admin'
from public.organizations o
join auth.users u on u.email = 'your-email@example.com'
where o.name = 'Hospital A'
on conflict (organization_id, user_id) do nothing;
```

## 4) Deploy to Vercel

1. Push this project to GitHub.
2. In [Vercel](https://vercel.com/), import the GitHub repository.
3. In Vercel project settings, add the same environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## How this starter works

- `app/page.tsx`: Daily/monthly/employee views and hospital selector.
- `app/api/schedules/route.ts`: Reads and saves tenant-scoped shift assignments.
- `app/api/organizations/route.ts`: Lists hospitals for the signed-in user.
- `lib/supabase.ts`: Shared Supabase client.
- `supabase/schema.sql`: Multi-tenant schema + RLS policies.

## Notes for next upgrades

- Add authentication (Supabase Auth) so only staff can edit schedules.
- Add weekly/monthly calendar views.
- Add role-based permissions (manager vs viewer).
