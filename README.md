# Junior IAS · LEAP

Landing page, registration API and admin dashboard for the **LEAP** programme
(Leadership · Excellence · Awareness · Purpose) by Junior IAS / WE4U IAS Coaching Centre.

- **Hosting:** Vercel (static page + one Node serverless function)
- **Database & admin login:** Supabase (Postgres + Auth, protected with Row Level Security)
- **E-mail:** parent confirmation + admin alert over SMTP (Gmail app password)

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | The LEAP landing page. The "Reserve a Seat" form posts JSON to `/api/register`. |
| `api/register.js` | Validates the form, saves it through the `submit_registration` database function, then sends the e-mails. |
| `api/_mail.js` | E-mail templates and SMTP sending (nodemailer). |
| `admin/index.html` | Dashboard: sign in, stats, search/filter, status + notes, CSV export. |
| `supabase/schema.sql` | Tables, RLS policies and functions. |

## How data is protected

- Visitors never touch the table directly. The form goes through `submit_registration()`,
  which only inserts.
- Only signed-in Supabase users listed in `admin_users` can read, update or delete registrations.
- The Supabase key in the code is the *publishable* key; it is safe to be public because of the RLS rules above.
- SMTP credentials live only in Vercel environment variables (see `.env.example`).

## Admins

Add an admin: Supabase dashboard → **Authentication → Users → Add user** (email + password,
tick *Auto confirm*), then in **SQL Editor**:

```sql
insert into public.admin_users (user_id, name)
select id, 'Admin name' from auth.users where email = 'admin@example.com';
```

Change a password: Authentication → Users → the user → **Reset password** / update.

## Local development

```
npm install
npx vercel dev
```

Open http://localhost:3000 (landing) and http://localhost:3000/admin/ (dashboard).
Copy `.env.example` to `.env` and fill in the mail settings to test e-mails locally.
