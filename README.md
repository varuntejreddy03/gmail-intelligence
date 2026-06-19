# 🧠 Gmail Intelligence Platform

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![Express](https://img.shields.io/badge/Express-5-000?style=for-the-badge&logo=express)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![NVIDIA](https://img.shields.io/badge/NVIDIA-NIM-76B900?style=for-the-badge&logo=nvidia&logoColor=white)

**An AI-powered email intelligence platform that connects to Gmail, processes emails with AI, and provides a conversational assistant grounded in your inbox.**

[Live Demo](https://repeatless.varuntej.online) · [Architecture](./Architecture.md) · [API Docs](#api-endpoints)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📬 **Gmail Sync** | OAuth 2.0 integration with full/incremental sync, pagination, rate limiting |
| 🤖 **AI Chat Agent** | Ask questions about your emails with source-cited, grounded answers |
| 📝 **Smart Compose** | Generate professional emails from natural language prompts |
| ↩️ **Thread-Aware Reply** | AI drafts replies with full conversation context + proper headers |
| 🏷️ **Auto Categorization** | Classify emails into 6 categories using NVIDIA NIM |
| 📊 **Summarization** | On-demand thread and message summaries |
| 🔍 **Semantic Search** | pgvector embeddings + keyword search for intelligent retrieval |

---

## 🏗️ Architecture

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Next.js Frontend  │────▶│   Express Backend    │────▶│    Supabase      │
│   (React + Auth)    │     │   (Business Logic)   │     │  (PostgreSQL +   │
│   Port 3000         │     │   Port 4000          │     │   pgvector)      │
└─────────────────────┘     └──────────┬───────────┘     └─────────────────┘
                                       │
                            ┌──────────┼───────────┐
                            ▼          ▼           ▼
                     ┌──────────┐ ┌────────┐ ┌──────────┐
                     │  Gemini  │ │  Groq  │ │  NVIDIA  │
                     │  (Primary│ │(Fallback│ │   NIM    │
                     │   + RAG) │ │  Chat) │ │(Classify)│
                     └──────────┘ └────────┘ └──────────┘
```

> Full architecture documentation: [Architecture.md](./Architecture.md)

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14, React 18, Tailwind CSS | UI + OAuth session |
| Backend | Express.js (TypeScript) | API + business logic |
| Database | Supabase (PostgreSQL + pgvector) | Storage + vector search |
| Primary AI | Google Gemini 2.0 Flash | Chat, summarization, compose |
| Fallback AI | Groq (Llama 3.1 8B) | Chat when Gemini quota exceeded |
| Classification | NVIDIA NIM (Llama 3.1 8B Instruct) | Email categorization |
| Embeddings | OpenRouter (text-embedding-3-small) | Semantic search vectors |
| Auth | NextAuth (Auth.js v5) | Google OAuth 2.0 |

---

## 📁 Project Structure

```
gmail-intelligence/
├── app/                          # Next.js Frontend
│   ├── (auth)/login/             # Login page
│   ├── (dashboard)/              # Inbox, Chat, Compose, Thread
│   └── api/auth/                 # NextAuth endpoints
│
├── backend/                      # Express API Server
│   ├── src/
│   │   ├── config/               # App configuration
│   │   ├── controllers/          # Request handlers
│   │   ├── errors/               # Error classes
│   │   ├── middleware/           # Auth, error handling
│   │   ├── routes/               # Route definitions
│   │   ├── services/             # Business logic
│   │   └── validators/           # Input validation
│   └── index.ts                  # Server entry (self-contained)
│
├── lib/                          # Shared Libraries
│   ├── ai/
│   │   ├── embeddings/           # Vector embeddings (OpenRouter)
│   │   ├── prompts/              # Prompt templates
│   │   ├── providers/            # LLM integrations
│   │   └── rag/                  # RAG pipeline
│   ├── database/                 # Supabase client + queries
│   ├── gmail/                    # Gmail API (client, sync, parser)
│   └── constants/                # App constants
│
├── components/                   # React UI Components
├── hooks/                        # Custom React hooks
├── store/                        # Zustand state management
├── types/                        # Shared TypeScript types
└── docs/                         # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud project with Gmail API enabled
- Supabase project with pgvector
- API keys: Gemini, NVIDIA NIM, Groq, OpenRouter

### 1. Clone & Install

```bash
git clone https://github.com/varuntejreddy03/gmail-intelligence.git
cd gmail-intelligence
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
# Fill in all values (see Environment Variables below)
```

### 3. Database Setup

Run the schema in Supabase SQL Editor:
```sql
-- Copy contents of lib/database/schema.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4. Google OAuth Setup

1. [Google Cloud Console](https://console.cloud.google.com/) → Enable Gmail API
2. Create OAuth 2.0 credentials (Web application)
3. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Add your email as test user in OAuth consent screen

### 5. Run Locally

```bash
# Terminal 1 — Frontend
npm run dev

# Terminal 2 — Backend
npm run dev:backend
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | NextAuth encryption secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GROQ_API_KEY` | Groq API key (chat fallback) |
| `NVIDIA_API_KEY` | NVIDIA NIM API key |
| `OPENROUTER_API_KEY` | OpenRouter API key (embeddings) |
| `TOKEN_ENCRYPTION_KEY` | AES-256 encryption key |
| `BACKEND_INTERNAL_SECRET` | Secret between frontend ↔ backend |

> See [.env.example](./.env.example) for full list with descriptions.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/v1/gmail/sync` | Trigger Gmail sync |
| `GET` | `/v1/gmail/messages` | List inbox threads (paginated) |
| `GET` | `/v1/gmail/thread/:id` | Get thread with all messages |
| `POST` | `/v1/gmail/send` | Send email via Gmail |
| `POST` | `/v1/ai/chat` | AI chat (RAG pipeline) |
| `POST` | `/v1/ai/summarize` | Summarize thread/message |
| `POST` | `/v1/ai/compose` | AI email composition |
| `POST` | `/v1/ai/categorize` | Classify single thread |
| `POST` | `/v1/ai/reprocess` | Batch categorize (max 25) |

---

## 🧪 AI Design

### RAG Pipeline
```
User Query → Keyword Extraction → Supabase Text Search → Build Context → Groq/Gemini → Response
```

- **Retrieval**: Extracts meaningful keywords, searches email subjects/body/sender
- **Context**: Formats retrieved emails with full source attribution (sender, subject, date, ID)
- **Generation**: Groq Llama 3.1 8B generates grounded responses with citations
- **Fallback**: If Gemini quota allows, uses Gemini 2.0 Flash as primary

### Categorization (NVIDIA NIM)
Classifies into: Newsletter, Job/Recruitment, Finance, Notifications, Personal, Work/Professional

### Anti-Hallucination
- System prompt enforces source-only answers
- Every response cites sender + subject
- Refuses to answer if information isn't in email context

---

## 📋 Gmail API Strategy

- **Initial Sync**: Paginated fetch of up to 10,000 messages with exponential backoff
- **Incremental Sync**: History-based delta updates via `historyId`
- **Rate Limiting**: Token bucket (250 units/sec) + retry with jitter
- **Thread Awareness**: Threads as first-class entities, messages nested within

---

## ⚠️ Notes

- **Google OAuth**: App is not Google-verified (takes 4-6 weeks). Click "Advanced" → "Go to app (unsafe)" when signing in.
- **Free Tier Limits**: Gemini has daily quota limits. Groq serves as automatic fallback.
- **Embeddings**: Generated via OpenRouter on sync. Text search used as fallback when embeddings unavailable.

---

## 🏛️ Trade-offs & Decisions

| Decision | Rationale |
|----------|-----------|
| On-demand AI processing | Conserves free-tier API quotas for 5000+ emails |
| Groq as fallback | Gemini 429s are common on free tier; Groq provides reliable fallback |
| Text search + embeddings | Hybrid approach works without pre-embedding all emails |
| Express separate from Next.js | Clear separation of concerns, independently scalable |
| Single `backend/index.ts` | Avoids tsx module caching issues in development |

---

## 📄 License

MIT

---

<div align="center">

Built with ☕ for the [Repeatless](https://repeatless.in) Technical Assessment

</div>
