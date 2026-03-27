1. Copy .env.example to .env and set values:

VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SUPABASE_FUNCTION_NAME=server

2. In Supabase SQL Editor, run:

supabase/sql/auth_profiles.sql

3. In Supabase Dashboard -> Authentication -> Users, create your first user (email/password).

4. Promote the first user to admin in SQL Editor:

update public.profiles
set role = 'admin', full_name = 'System Admin'
where email = '<your-admin-email>';

5. Start app:

npm install
npm run dev -- --host

6. Login from /login with the user email/password.

7. Role redirects:
- admin -> /admin-dashboard
- teacher -> /teacher-dashboard
