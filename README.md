# Daily Planning Hub

Construction daily planning tool built with React + TypeScript + Tailwind CSS. Integrates with Procore for project/crew/equipment data and Microsoft 365 for email sending.

## Features

- **Procore Integration** — OAuth login, pull projects, sub jobs, employees, equipment, clients from head contracts
- **Searchable Dropdowns** — Type-to-filter comboboxes on all select fields
- **Email Sending** — Microsoft 365 Graph API with styled HTML template, seasonal safety tags, auto CC
- **Procore Daily Log** — Automatically posts a notes log entry when an email is sent
- **Dashboard** — Stats overview of plans sent, emails, projects
- **Email History** — Full log of all sent/failed emails
- **Offline Support** — localStorage persistence with cloud sync
- **SQLite Backend** — Express + better-sqlite3 API for plan storage

## Prerequisites

- **Node.js** v18+ (LTS recommended)
- **npm** v9+
- **Azure AD App Registration** — for Microsoft 365 email (Mail.Send, User.Read permissions)
- **Procore Developer App** — OAuth2 credentials with company access

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/jimflower/planning.git
cd planning

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# 4. Run both frontend + backend
npm run dev:all
```

The app will be available at **http://localhost:5173** and the API at **http://localhost:3001**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (frontend only) |
| `npm run server` | Start Express API server (port 3001) |
| `npm run dev:all` | Start both frontend + backend concurrently |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

### Microsoft 365 / Azure AD
| Variable | Description |
|----------|-------------|
| `VITE_AZURE_CLIENT_ID` | Azure AD Application (client) ID |
| `VITE_AZURE_TENANT_ID` | Azure AD Directory (tenant) ID |
| `VITE_AZURE_REDIRECT_URI` | `http://localhost:5173` for dev, production URL for prod |
| `VITE_AZURE_AUTHORITY` | `https://login.microsoftonline.com/{tenant_id}` |

### Procore
| Variable | Description |
|----------|-------------|
| `VITE_PROCORE_CLIENT_ID` | Procore OAuth app client ID |
| `VITE_PROCORE_CLIENT_SECRET` | Procore OAuth app client secret |
| `VITE_PROCORE_REDIRECT_URI` | `http://localhost:5173/procore/callback` for dev |
| `VITE_PROCORE_API_BASE_URL` | `https://api.procore.com` |
| `VITE_PROCORE_COMPANY_ID` | Your Procore company ID |

## Project Structure

```
├── server/             # Express + SQLite backend
│   ├── db.ts           # Database schema & queries
│   └── index.ts        # Express API routes (port 3001)
├── src/
│   ├── components/     # React components
│   │   ├── common/     # Header, SearchableSelect, OfflineIndicator
│   │   └── planning/   # PlanningForm, CrewRow, HeaderSection, etc.
│   ├── config/         # MSAL, Procore, site config
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Constants, utilities, date helpers
│   ├── pages/          # Route pages (Home, Dashboard, History, Settings)
│   ├── services/       # Auth, Graph API, Procore API, email template
│   ├── store/          # Zustand stores (planning, email log, settings)
│   ├── styles/         # Global CSS + Tailwind
│   └── types/          # TypeScript type definitions
├── .env.example        # Environment variable template
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts      # Vite config with Procore proxy
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS 3.4, Zustand, React Router v6
- **Backend:** Express 5, better-sqlite3, tsx
- **Auth:** MSAL (Azure AD), Procore OAuth2
- **Email:** Microsoft Graph API
- **Build:** Vite 6

## Production Deployment

1. Update `.env` redirect URIs to your production domain
2. Run `npm run build` — outputs to `dist/`
3. Serve `dist/` with any static host (Nginx, Azure Static Web Apps, etc.)
4. Run the backend separately: `npm run server`
