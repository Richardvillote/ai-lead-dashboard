# AI Lead Generation Dashboard

A full-stack Next.js application for service businesses to capture leads from a landing page and manage them through a CRM-style dashboard.

## Features

- **Landing Page** with lead capture form (name, email, phone, service, message)
- **Lead Status Tracking**: New -> Contacted -> Qualified -> Closed
- **Dashboard** showing all leads, pipeline stats, and conversion rate
- **Email Notifications** when a new lead is submitted
- **Appointment Scheduling** per lead (Call, Meeting, Demo)
- **Call Logging** with outcome tracking (Answered, Voicemail, No Answer)

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Prisma v7** + SQLite (via better-sqlite3 adapter)
- **Nodemailer** for email notifications
- **Lucide React** for icons

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/yourusername/ai-lead-dashboard.git
cd ai-lead-dashboard
npm install
```

### 2. Configure environment variables

Copy `.env` and fill in your values:

```bash
DATABASE_URL="file:./dev.db"
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your@email.com"
EMAIL_PASS="your-app-password"
EMAIL_TO="admin@yourbusiness.com"
NEXT_PUBLIC_BUSINESS_NAME="Your Business Name"
NEXT_PUBLIC_BUSINESS_TAGLINE="Professional Services You Can Trust"
```

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833).

### 3. Set up the database

```bash
npx prisma migrate dev --name init
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page.
Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the admin dashboard.

## Project Structure

```
app/
  page.tsx                  # Landing page
  layout.tsx                # Root layout
  api/
    leads/                  # Lead CRUD endpoints
    appointments/           # Appointment CRUD endpoints
    calls/                  # Call log endpoint
    stats/                  # Dashboard statistics
  dashboard/
    page.tsx                # Overview
    leads/page.tsx          # Lead management
    appointments/page.tsx   # Appointments
    calls/page.tsx          # Call logs
lib/
  db.ts                     # Prisma client
  email.ts                  # Email notifications
  utils.ts                  # Shared utilities
prisma/
  schema.prisma             # Database schema
```

## Customization

- Update `NEXT_PUBLIC_BUSINESS_NAME` and `NEXT_PUBLIC_BUSINESS_TAGLINE` in `.env`
- Edit `app/page.tsx` to change the services list and landing page copy
- Modify status labels in `lib/utils.ts`

## Database Management

```bash
# View and edit data in a browser UI
npx prisma studio

# Reset and re-migrate
npx prisma migrate reset
```

## Deployment

For production, replace SQLite with PostgreSQL or MySQL:
1. Update `prisma/schema.prisma` datasource provider
2. Update `lib/db.ts` to use the appropriate Prisma adapter
3. Set `DATABASE_URL` to your production database connection string

## License

MIT
