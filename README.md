# AMS — Asset Management System

Django REST backend + Next.js frontend for the NED University asset-management workflow (stock entries, registers, inspections, items, roles).

## Repository layout

```
AMS/
├── ams-backend/         Django 5.2 + DRF + SimpleJWT + PostgreSQL (pgvector)
└── ams-frontend-next/   Next.js (App Router) dashboard
```

## Prerequisites

- **Python 3.12+** (project is tested on 3.14)
- **Node.js 20+** and **npm** 10+
- **PostgreSQL 16+** with the **pgvector** extension installed on the DB server

---

## Backend — `ams-backend/`

### First-time setup

```bash
cd ams-backend

# Create and activate a virtualenv
python -m venv venv
source venv/Scripts/activate       # Git Bash on Windows
# source venv/bin/activate         # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env: SECRET_KEY, DB_*, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS, COOKIE_SECURE=False for local HTTP

# Apply migrations
python manage.py migrate

# Create a superuser
python manage.py createsuperuser
```

### Start the backend dev server

```bash
cd ams-backend
source venv/Scripts/activate
python manage.py runserver 8000
```

API available at **http://localhost:8000/api/**

### Useful commands

```bash
# Run the full test suite
python manage.py test --verbosity=1 --parallel=1 --noinput

# Run only security tests
python manage.py test ai_assistant.tests_security ams.tests_security user_management.tests_security

# Django system check
python manage.py check

# Make / inspect migrations
python manage.py makemigrations
python manage.py showmigrations
```

---

## Frontend — `ams-frontend-next/`

### First-time setup

```bash
cd ams-frontend-next
npm install
```

Configure the backend URL if needed (defaults to `http://localhost:8000`) in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Start the frontend dev server

```bash
cd ams-frontend-next
npm run dev
```

UI available at **http://localhost:3000**

### Useful commands

```bash
# Production build
npm run build

# Start the built app
npm run start

# Run the vitest unit-test suite
npx vitest run

# Type check
npx tsc --noEmit --skipLibCheck
```

---

## Quick start (two terminals)

```bash
# Terminal 1 — backend
cd ams-backend && source venv/Scripts/activate && python manage.py runserver 8000

# Terminal 2 — frontend
cd ams-frontend-next && npm run dev
```

Open **http://localhost:3000** and log in with your superuser credentials.

---

## Branches

- **`main`** — baseline (pre-REVAMP) codebase
- **`REVAMP`** — current working branch with user-management revamp, digital registers section, perf optimizations, security hardening (CVE patch, scoped rate limits, GZip), avatar upload, employee-ID auto-generation
