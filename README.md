# Gmail Intelligence Platform

An AI-powered email management platform that connects to Gmail, processes emails intelligently, and provides a conversational AI assistant grounded in your inbox data.

## Features

- **Gmail Integration** — OAuth 2.0 authentication, full inbox sync with pagination, incremental sync
- **AI Chat Agent** — Ask questions about your emails with source-cited answers (RAG pipeline)
- **Email Summarization** — On-demand thread and message summaries via Gemini AI
- **Compose & Reply** — AI-drafted emails from natural language prompts with thread context
- **Email Categorization** — Auto-classify emails (Newsletter, Job, Finance, Notifications, Personal, Work) via NVIDIA NIM
- **Thread Awareness** — All features operate on threads as first-class entities

## Architecture

```
Browser → Next.js (Auth + Proxy) → Express Backend (Business Logic) → Supabase + AI APIs
                                                                    → Worker (Gmail Sync via Upstash Redis)
```

See [Architecture.md](./Architecture.md) for full system design documentation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Express.js (TypeScript) |
| Database | Supabase (PostgreSQL + pgvector) |
| Primary AI | Google Gemini 2.0 Flash (+ DeepSeek fallback via OpenRouter) |
| Secondary AI | NVIDIA NIM (meta/llama-3.1-8b-instruct) |
| Queue | Upstash Redis |
| Auth | NextAuth (Auth.js v5) with Google OAuth |

## Project Structure

```
gmail-intelligence/
├── app/                    # Next.js App Router (frontend + auth)
│   ├── (auth)/login/       # Login page
│   ├── (dashboard)/        # Protected dashboard pages
│   │   ├── chat/           # AI chat page
│   │   ├── compose/        # Email composition page
│   │   ├── inbox/          # Inbox redirect
│   │   └── thread/[id]/    # Thread detail view
│   └── api/
│       ├── auth/           # NextAuth endpoints
│       └── v1/[...path]/   # Catch-all proxy to Express backend
├── backend/                # Express.js backend (port 4000)
│   ├── middleware/auth.ts  # Internal secret validation
│   ├── routes/gmail.ts     # Gmail sync, list, send endpoints
│   ├── routes/ai.ts        # Chat, summarize, compose, categorize
│   └── index.ts            # Express server entry
├── worker/                 # Background job processor
│   └── index.ts            # Polls Upstash Redis for sync jobs
├── lib/                    # Shared libraries
│   ├── ai/                 # AI integrations (Gemini, NVIDIA, RAG)
│   ├── gmail/              # Gmail API client, parser, rate limiter
│   ├── queue/              # Upstash Redis queue utilities
│   ├── supabase/           # Database client, queries, schema
│   └── utils/              # Crypto, sanitization helpers
├── components/             # React components
├── types/                  # Shared TypeScript types
├── Architecture.md         # System design document
└── .env.example            # Environment variables template
```

## Local Setup

### Prerequisites

- Node.js 18+
- npm
- Google Cloud project with Gmail API enabled
- Supabase project
- API keys for: Gemini, NVIDIA NIM, OpenRouter (fallback)

### 1. Install Dependencies

```bash
cd gmail-intelligence
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` (see Environment Variables section below).

### 3. Set Up Supabase

Run the schema in your Supabase SQL editor:
```bash
# Copy contents of lib/supabase/schema.sql into Supabase SQL Editor
```

Enable the pgvector extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add your email as a test user in OAuth consent screen → Audience

### 5. Run the Application

Open **3 terminals**:

```bash
# Terminal 1 — Frontend (port 3000)
npm run dev

# Terminal 2 — Backend (port 4000)
npm run dev:backend

# Terminal 3 — Worker (background sync)
npm run dev:worker
```

### 6. Use the App

1. Open http://localhost:3000
2. Sign in with Google
3. Click "SYNC GMAIL" to start email sync
4. Browse inbox, use AI chat, compose emails

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | NextAuth session encryption secret (generate with `openssl rand -base64 32`) |
| `AUTH_URL` | Application URL (`http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GEMINI_API_KEY` | Google Gemini API key from [AI Studio](https://aistudio.google.com/apikey) |
| `NVIDIA_API_KEY` | NVIDIA NIM API key from [build.nvidia.com](https://build.nvidia.com) |
| `NVIDIA_API_BASE` | NVIDIA NIM base URL (`https://integrate.api.nvidia.com/v1`) |
| `OPENROUTER_API_KEY` | OpenRouter API key for DeepSeek fallback |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `TOKEN_ENCRYPTION_KEY` | AES-256 key for encrypting OAuth tokens at rest |
| `BACKEND_URL` | Express backend URL (`http://localhost:4000`) |
| `BACKEND_INTERNAL_SECRET` | Shared secret between Next.js and Express |
| `BACKEND_PORT` | Express port (`4000`) |

## API Endpoints (Express Backend)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/v1/gmail/sync` | Queue Gmail sync job |
| GET | `/v1/gmail/messages` | List inbox threads (paginated) |
| GET | `/v1/gmail/thread/:id` | Get thread with messages |
| POST | `/v1/gmail/send` | Send email via Gmail API |
| POST | `/v1/ai/chat` | RAG-powered inbox chat |
| POST | `/v1/ai/summarize` | Summarize thread or message |
| POST | `/v1/ai/compose` | AI email composition |
| POST | `/v1/ai/categorize` | Categorize single thread |
| POST | `/v1/ai/reprocess` | Batch categorize (max 25) |

## Key Libraries

- `@google/generative-ai` — Google Gemini SDK
- `openai` — OpenAI-compatible client (used for NVIDIA NIM + OpenRouter)
- `googleapis` — Gmail API client
- `@supabase/supabase-js` — Supabase database client
- `@upstash/redis` — Serverless Redis queue
- `next-auth` — Authentication framework
- `express` — Backend HTTP framework
- `zod` — Runtime validation

## License

MIT
