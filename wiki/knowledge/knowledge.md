# AI Lead Dashboard - Project Knowledge Base

## Overview

AI Lead Dashboard is a full-stack Next.js application for service businesses to capture, track, and manage leads. It includes a public-facing landing page with a lead capture form and a private dashboard for managing leads, appointments, and call logs.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: SQLite via Prisma ORM v7 with `@prisma/adapter-better-sqlite3`
- **Email**: Nodemailer (SMTP)
- **Icons**: Lucide React
- **Date utilities**: date-fns

## Project Structure

```
ai-lead-dashboard/
  app/
    page.tsx                          # Landing page with lead capture form
    layout.tsx                        # Root layout
    globals.css                       # Global styles (Tailwind v4)
    api/
      leads/
        route.ts                      # GET all leads, POST new lead
        [id]/route.ts                 # GET, PATCH, DELETE single lead
      appointments/
        route.ts                      # GET all appointments, POST new
        [id]/route.ts                 # PATCH, DELETE appointment
      calls/route.ts                  # POST call log
      stats/route.ts                  # GET dashboard statistics
    dashboard/
      layout.tsx                      # Dashboard sidebar layout
      page.tsx                        # Overview with stats + pipeline
      leads/page.tsx                  # Lead management table + detail panel
      appointments/page.tsx           # Appointment cards
      calls/page.tsx                  # Call log table
  lib/
    db.ts                             # Prisma client singleton (with better-sqlite3 adapter)
    email.ts                          # Nodemailer send function
    utils.ts                          # Status colors, labels, order constants
  prisma/
    schema.prisma                     # Database models
    dev.db                            # SQLite database file
  wiki/
    knowledge/knowledge.md            # This file
    docs/                             # Additional documentation
```

## Database Models

### Lead
- `id` (cuid), `name`, `email`, `phone?`, `service?`, `message?`
- `status`: NEW | CONTACTED | QUALIFIED | CLOSED (default: NEW)
- `source?` (default: "website"), `notes?`
- Relations: has many Appointments, has many CallLogs

### Appointment
- `id`, `leadId` (FK), `title`, `scheduledAt` (DateTime)
- `duration` (minutes, default: 30)
- `type`: CALL | MEETING | DEMO (default: CALL)
- `status`: SCHEDULED | COMPLETED | CANCELLED (default: SCHEDULED)
- `notes?`

### CallLog
- `id`, `leadId` (FK), `calledAt` (default: now())
- `duration?` (seconds), `outcome?` (ANSWERED | VOICEMAIL | NO_ANSWER)
- `notes?`

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/leads | Fetch all leads with appointments + calls |
| POST | /api/leads | Create new lead + trigger email notification |
| GET | /api/leads/[id] | Get single lead |
| PATCH | /api/leads/[id] | Update lead (status, notes, etc.) |
| DELETE | /api/leads/[id] | Delete lead (cascades to appointments + calls) |
| GET | /api/appointments | All appointments with lead info |
| POST | /api/appointments | Create appointment for a lead |
| PATCH | /api/appointments/[id] | Update appointment status |
| DELETE | /api/appointments/[id] | Delete appointment |
| POST | /api/calls | Log a call for a lead |
| GET | /api/stats | Aggregated stats (total, by status, conversion rate) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | SQLite path, e.g. `file:./dev.db` |
| EMAIL_HOST | SMTP host (e.g. smtp.gmail.com) |
| EMAIL_PORT | SMTP port (e.g. 587) |
| EMAIL_USER | SMTP username / from address |
| EMAIL_PASS | SMTP password / app password |
| EMAIL_TO | Admin email to receive lead notifications |
| NEXT_PUBLIC_BUSINESS_NAME | Business name shown on landing page |
| NEXT_PUBLIC_BUSINESS_TAGLINE | Tagline shown on landing page |
| NEXT_PUBLIC_APP_URL | App URL for email links (optional) |

## Key Implementation Notes

### Prisma 7 Configuration
Prisma 7 no longer supports `url` in the datasource block of schema.prisma. Instead:
- The database URL is configured in `prisma.config.ts`
- A driver adapter (`@prisma/adapter-better-sqlite3`) is required
- The `lib/db.ts` creates the adapter with `better-sqlite3` and passes it to `PrismaClient`

### Lead Status Flow
NEW -> CONTACTED -> QUALIFIED -> CLOSED

Status can be updated inline from the leads table via a select dropdown, or via PATCH /api/leads/[id].

### Email Notifications
On POST /api/leads, `sendLeadNotification()` is called non-blocking (no await at the handler level) so email failures don't affect the API response.

### Next.js 15 Params
In Next.js 15, route segment params (`{ params }`) must be awaited since they are Promises. All dynamic route handlers use `const { id } = await params`.

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Prisma commands
npx prisma migrate dev --name <migration-name>
npx prisma generate
npx prisma studio          # Visual DB browser at localhost:5555
```
