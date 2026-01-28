# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plataforma Otus - A full-stack web application for project management and indicators visualization for Otus Engenharia. Built with React/Vite frontend and Node.js/Express backend, integrating with Google BigQuery for analytics data and Supabase for real-time data.

## Development Commands

### Backend (port 3001)
```bash
cd backend
npm install          # Install dependencies
npm start            # Start server (node server.js)
npm run dev          # Start with watch mode (node --watch server.js)
```

### Frontend (port 5173)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Docker (production)
```bash
docker-compose -f docker-compose.yaml up --build
```

## Architecture

### Backend (`backend/`)
- **server.js**: Express server with all API routes, authentication middleware, session management, rate limiting, and serves static frontend in production
- **bigquery.js**: Google BigQuery client - contains all SQL queries for portfolio, curves, schedules, costs, hours data
- **supabase.js**: Supabase client - handles real-time data, user feedback, logs, OKRs, indicators
- **auth.js**: Passport.js configuration for Google OAuth 2.0
- **auth-config.js**: User roles mapping (director/admin/leader) and email-to-leader-name mappings for data filtering

### Frontend (`frontend/src/`)
- **App.jsx**: Main router with navigation sidebar, route definitions, and layout
- **contexts/AuthContext.jsx**: Authentication state management
- **contexts/OracleContext.jsx**: Oracle chat assistant state
- **components/**: View components (PortfolioView, CurvaSView, CronogramaView, CSView, etc.)

### Data Flow
1. Frontend calls `/api/*` endpoints
2. Backend authenticates via Passport session
3. For leaders, data is filtered by their name in the `lider` column
4. BigQuery returns analytics data; Supabase returns real-time/operational data

### Authentication & Authorization
- Google OAuth 2.0 with three roles: `director` (full access), `admin` (full access), `leader` (filtered to own projects)
- Role mappings defined in `auth-config.js`
- Leader names must match exactly with BigQuery `lider` column values

## Environment Variables

Backend requires `.env` file with:
- `GOOGLE_APPLICATION_CREDENTIALS` / `BIGQUERY_PROJECT_ID` / `BIGQUERY_DATASET` - BigQuery connection
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` - Supabase connection
- `SESSION_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Auth config
- `FRONTEND_URL` - For CORS (default: https://app.otusengenharia.com)

## Key API Routes

- `GET /api/health` - Health check
- `GET /api/portfolio` - Portfolio data (filtered by user role)
- `GET /api/curva-s` - S-Curve progress data
- `GET /api/cronograma` - Project schedules
- `GET /api/cs` - Customer Success / NPS data
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback

## Language

The codebase, comments, and documentation are in Portuguese (Brazilian). Variable names and code structure follow English conventions.
