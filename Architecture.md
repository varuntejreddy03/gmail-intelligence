# Architecture & Design Document

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│  Next.js 14 App Router — React UI + NextAuth Session                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ /api/v1/* (authenticated proxy)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API LAYER (port 3000)                     │
│  • NextAuth Google OAuth (session + token management)               │
│  • Catch-all proxy: validates session → forwards to Express         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ x-internal-secret + x-user-id headers
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   EXPRESS BACKEND (port 4000)                        │
│  • /v1/gmail/* — Sync, list threads, send emails                    │
│  • /v1/ai/*   — Chat, summarize, compose, categorize                │
│  • Auth middleware validates internal secret                         │
└────────┬──────────────┬──────────────┬──────────────┬───────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌──────────────┐ ┌────────────┐ ┌───────────┐ ┌──────────────┐
│  Gmail API   │ │  Gemini AI │ │ NVIDIA NIM│ │ Upstash Redis│
│  (OAuth 2.0) │ │  (Primary) │ │(Secondary)│ │   (Queue)    │
└──────────────┘ └─────┬──────┘ └───────────┘ └──────┬───────┘
                       │                              │
                       ▼ (fallback on 429)            ▼
                ┌─────────────┐              ┌──────────────┐
                │ OpenRouter   │              │    Worker     │
                │ (DeepSeek)   │              │ (Gmail Sync)  │
                └─────────────┘              └──────────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────┐
                                    │   Supabase (PostgreSQL)    │
                                    │   + pgvector extension     │
                                    └───────────────────────────┘
```

### Component Roles

| Component | Responsibility |
|-----------|---------------|
| **Next.js Frontend** | UI rendering, Google OAuth via NextAuth, session management, proxies API calls to Express |
| **Express Backend** | All business logic: Gmail operations, AI processing, email retrieval, categorization |
| **Worker** | Background job processor: consumes Gmail sync jobs from Upstash Redis queue |
| **Supabase** | PostgreSQL database with pgvector extension for email storage, embeddings, categories, chat sessions |
| **Upstash Redis** | Lightweight queue (LPUSH/RPOP) for async Gmail sync jobs |
| **Google Gemini** | Primary AI model for chat, summarization, composition, replies |
| **OpenRouter (DeepSeek)** | Fallback when Gemini quota is exhausted (429 errors) |
| **NVIDIA NIM** | Secondary AI model for email categorization (Llama 3.1 8B Instruct) |

---

## 2. Database Schema

### Tables

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Deterministic hash from Google provider ID |
| email | TEXT NOT NULL | Gmail address |
| name | TEXT | Display name |
| avatar_url | TEXT | Profile picture URL |
| google_access_token | TEXT | Encrypted OAuth access token |
| google_refresh_token | TEXT | Encrypted OAuth refresh token |
| google_token_expires_at | TIMESTAMPTZ | Token expiry |
| last_sync_at | TIMESTAMPTZ | Last successful sync timestamp |
| created_at | TIMESTAMPTZ | Account creation |

#### `email_threads`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Gmail thread ID |
| user_id | UUID (FK → users) | Owner |
| subject | TEXT | Thread subject |
| snippet | TEXT | Preview text |
| participants | TEXT[] | All email addresses in thread |
| last_message_at | TIMESTAMPTZ | Most recent message timestamp |
| message_count | INTEGER | Number of messages |
| summary | TEXT | AI-generated thread summary (on-demand) |
| category | TEXT | AI-assigned category |
| is_read | BOOLEAN | Read status |
| labels | TEXT[] | Gmail labels |
| created_at | TIMESTAMPTZ | First synced |

#### `email_messages`
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Gmail message ID |
| thread_id | TEXT (FK → email_threads) | Parent thread |
| user_id | UUID (FK → users) | Owner |
| from_name | TEXT | Sender display name |
| from_email | TEXT | Sender email |
| to_recipients | JSONB | Array of {name, email} |
| cc_recipients | JSONB | CC recipients |
| subject | TEXT | Message subject |
| body_text | TEXT | Plain text body |
| body_html | TEXT | HTML body |
| snippet | TEXT | Gmail snippet |
| date | TIMESTAMPTZ | Message date |
| rfc_message_id | TEXT | RFC 2822 Message-ID header |
| in_reply_to | TEXT | In-Reply-To header |
| references | TEXT | References header |
| gmail_labels | TEXT[] | Gmail labels |
| summary | TEXT | AI-generated summary (on-demand) |
| is_read | BOOLEAN | Read status |
| created_at | TIMESTAMPTZ | First synced |

#### `email_embeddings`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| message_id | TEXT (FK → email_messages) | Source message |
| thread_id | TEXT (FK → email_threads) | Source thread |
| user_id | UUID (FK → users) | Owner |
| content_chunk | TEXT | Text chunk that was embedded |
| chunk_index | INTEGER | Position in message |
| embedding | vector(768) | Gemini text-embedding-004 vector |

#### `email_categories`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| thread_id | TEXT (FK → email_threads) | Categorized thread |
| user_id | UUID (FK → users) | Owner |
| category | TEXT | Assigned category |
| confidence | FLOAT | Model confidence (0-1) |
| model_used | TEXT | Which model classified this |
| created_at | TIMESTAMPTZ | Classification timestamp |

#### `chat_sessions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| user_id | UUID (FK → users) | Owner |
| title | TEXT | Session title (from first message) |
| created_at | TIMESTAMPTZ | Session start |

#### `chat_messages`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| session_id | UUID (FK → chat_sessions) | Parent session |
| role | TEXT | "user" or "assistant" |
| content | TEXT | Message content |
| source_message_ids | TEXT[] | Referenced email message IDs |
| source_thread_ids | TEXT[] | Referenced thread IDs |
| created_at | TIMESTAMPTZ | Message timestamp |

#### `sync_state`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| user_id | UUID (UNIQUE, FK → users) | Owner |
| history_id | TEXT | Gmail history ID for incremental sync |
| last_full_sync_at | TIMESTAMPTZ | Last full sync |
| last_incremental_sync_at | TIMESTAMPTZ | Last incremental sync |
| sync_status | TEXT | "idle", "running", "error" |
| created_at | TIMESTAMPTZ | Record creation |

### Indexes
- `email_threads(user_id, category)` — Filter by category
- `email_threads(user_id, last_message_at DESC)` — Chronological listing
- `email_messages(user_id, thread_id, date)` — Thread message ordering
- `email_messages(user_id, from_email)` — Sender search
- `email_embeddings(user_id)` + HNSW index on `embedding` — Vector similarity search
- `sync_state(user_id)` — UNIQUE constraint

### Data Modeling Decisions
- **Thread-first design**: Threads are the primary entity; messages belong to threads. This mirrors Gmail's data model.
- **Denormalized thread metadata**: `message_count`, `last_message_at`, `participants` are stored on the thread and recomputed on sync. This avoids expensive JOINs for inbox listing.
- **pgvector for embeddings**: The `email_embeddings` table stores chunked email content with 768-dimensional vectors from Gemini's `text-embedding-004` model. This enables semantic search for the RAG pipeline. Currently disabled in favor of text search to conserve free-tier quotas — architecture supports enabling it when quota allows.
- **Separate categories audit table**: `email_categories` stores classification history with confidence scores, enabling model performance tracking. The denormalized `category` field on `email_threads` provides fast filtering.

---

## 3. AI Design

### Email Summarization

**Strategy**: On-demand summarization (not pre-computed) to conserve API quotas.

- **Individual emails**: The full email body (capped at 30,000 chars) is sent to Gemini with a prompt requesting 2-3 sentence summary.
- **Thread summaries**: All messages in a thread are concatenated chronologically with sender/date metadata into a "thread context" string, then sent to Gemini asking for a conversation arc summary.
- **Chunking for long threads**: Thread context is capped at 30,000 characters from the tail end (most recent messages preserved). For individual emails exceeding the limit, content is truncated.

### RAG Pipeline (Chat Agent)

```
User Query → Text Search (Supabase ilike) → Build Context → Gemini/DeepSeek → Response
```

1. **Retrieval**: The user's query is tokenized into search terms. Supabase performs `ilike` pattern matching against `subject`, `body_text`, `from_email`, and `from_name` columns. If no matches, the 10 most recent emails are used as context.
2. **Context Building**: Retrieved emails are formatted with full source attribution:
   ```
   [Source 1]
   From: sender@example.com
   Subject: Project Update
   Date: 2024-01-15
   Message ID: abc123
   Thread ID: thread456
   Content: <email body truncated to 1500 chars>
   ```
3. **Generation**: The context + user query + conversation history are sent to the AI model with a system prompt that enforces:
   - Answer ONLY from provided email context
   - Cite sources using [Source: from@email, Subject: '...', Date: ...]
   - Say "I could not find that information" if not in context
   - Synthesize across multiple emails when relevant

### Source Clarity
Every RAG context block includes the sender email, subject, date, message ID, and thread ID. The system prompt explicitly instructs the model to cite sources in its response. Source message/thread IDs are also returned to the frontend for the "Cited Sources" panel.

### NVIDIA NIM Model Choice
**Model**: `meta/llama-3.1-8b-instruct`

**Rationale**:
- Available on NVIDIA NIM free tier
- Fast inference (8B parameters)
- Excellent at structured classification tasks
- Outputs reliable JSON when instructed
- Used exclusively for email categorization — a task that doesn't require large context windows

**Role**: Classifies emails into 6 categories (Newsletter, Job/Recruitment, Finance, Notifications, Personal, Work/Professional) with confidence scores. The prompt requests JSON output: `{"category": "...", "confidence": 0.0-1.0}`.

### Hallucination Prevention
1. **System prompt**: Explicitly states "ONLY answer based on email context provided. Never invent information."
2. **Grounded retrieval**: AI only sees retrieved emails, not the full inbox
3. **Source attribution required**: Prompt requires citing sources for every claim
4. **Graceful refusal**: If context doesn't contain relevant information, model is instructed to say so clearly
5. **No creative generation in chat**: The chat agent is configured with low temperature (0.3) to minimize creative outputs

---

## 4. Gmail API Strategy

### Initial Sync vs. Incremental Sync

**Initial Sync**:
1. Check if `sync_state.last_full_sync_at` exists — if yes, skip
2. Paginate through `users.messages.list` (up to 10,000 messages)
3. Fetch full message content in batches of 10 (parallel)
4. Parse headers, body, labels; upsert into Supabase
5. Refresh denormalized thread metadata
6. Store Gmail `historyId` for future incremental syncs

**Incremental Sync**:
1. Use stored `historyId` to call `users.history.list`
2. Extract `messagesAdded` and label changes
3. Fetch and upsert only changed messages
4. Update affected thread metadata

### Pagination for Large Inboxes
- Gmail API returns `nextPageToken` with each page
- Loop continues until no more pages or 10,000 message cap reached
- Each page requests up to 500 messages
- Processing happens in batches of 10 to avoid memory issues
- Sync runs as a background job (via queue) so UI remains responsive

### Rate Limiting and Quota Handling

**Token Bucket Rate Limiter** (`lib/gmail/rate-limiter.ts`):
- 250 quota units per second budget
- Each API call reserves its quota cost before executing
- If budget is exhausted, requests wait until next refill window

**Retry with Exponential Backoff**:
- Up to 5 retries per operation
- Exponential delay: 1s, 2s, 4s, 8s, 16s (capped at 32s)
- Random jitter added to prevent thundering herd
- Transient errors (429, 5xx) trigger retry; client errors (4xx) do not

**401 Handling**: If a 401 is received, token refresh is attempted once before retrying.

---

## 5. Tool & Technology Decisions

| Technology | Justification |
|-----------|---------------|
| **Next.js 14 (App Router)** | Full-stack React framework with built-in routing, SSR, and middleware. Handles OAuth callbacks and session management natively with NextAuth. |
| **Express.js** | Lightweight, well-understood backend framework. Separates business logic from the frontend. Easy to test and deploy independently. |
| **TypeScript** | Type safety across the full stack. Shared types between frontend/backend via `types/` directory. |
| **Supabase** | Managed PostgreSQL with built-in pgvector support, real-time capabilities, and generous free tier. Eliminates DevOps overhead. |
| **pgvector** | Native PostgreSQL vector similarity search. Schema supports it for future embedding-based RAG when Gemini quotas allow. Currently using text search as a pragmatic alternative. |
| **Upstash Redis** | Serverless Redis with REST API. Perfect for job queues without managing Redis infrastructure. Free tier sufficient for this use case. |
| **Tailwind CSS** | Utility-first CSS for rapid UI development. Dark theme with custom design tokens. |
| **NextAuth (Auth.js v5)** | Handles Google OAuth complexity — token refresh, session management, CSRF protection — out of the box. |
| **Google Gemini** | Required by spec. Free tier offers 15 RPM. `gemini-2.0-flash` provides good quality with fast inference. |
| **OpenRouter + DeepSeek** | Fallback for Gemini 429 errors. DeepSeek V3 provides high-quality responses at minimal cost via OpenRouter. |
| **NVIDIA NIM** | Required by spec. Free-tier `meta/llama-3.1-8b-instruct` is excellent for structured classification tasks. |

---

## 6. Trade-offs & Limitations

### Deliberate Simplifications

| Decision | Rationale |
|----------|-----------|
| **Text search over vector search for RAG** | Gemini's embedding API shares the same free-tier quota. Pre-embedding 4000+ emails would exhaust quota instantly. Text search (Supabase `ilike`) provides adequate retrieval for most queries. |
| **On-demand summarization** | Pre-summarizing all emails on sync would burn through Gemini/DeepSeek quotas. Summaries are generated only when a user views a thread. |
| **Categorization via UI button** | Auto-categorizing 4000 emails on sync would hit NVIDIA rate limits. The "AI Categorize" button processes 25 threads per click. |
| **No real-time push notifications** | Gmail push notifications via Pub/Sub require a deployed webhook URL. Omitted for local development simplicity. |
| **Newsletter deduplication not implemented** | Bonus feature deprioritized in favor of core feature stability. |
| **Single-user optimized** | The architecture supports multi-user but testing focused on single-user flows. |

### What I Would Do Differently With More Time

1. **Enable pgvector embeddings**: With a paid Gemini tier, pre-embed all emails on sync for superior semantic search.
2. **Streaming chat responses**: Use Server-Sent Events for streaming AI responses character-by-character.
3. **Gmail Pub/Sub push**: Real-time inbox updates without manual sync.
4. **Newsletter deduplication**: Use embedding similarity to deduplicate stories across newsletter sources.
5. **Caching layer**: Cache frequently accessed threads and summaries to reduce database load.
6. **Background batch categorization**: A scheduled job that categorizes new emails in small batches during off-peak hours.
7. **Email search with full-text indexing**: Add PostgreSQL GIN/GiST indexes for faster text search on large inboxes.
8. **Deploy to production**: Vercel (frontend) + Railway/Render (Express backend) + Supabase (managed DB).
