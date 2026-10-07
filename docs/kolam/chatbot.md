# Guest Chatbot (KOLAM Assistant)

> The bot now acts as a Front Office Executive with a knowledge layer, conversation context and live availability in the
> prompt. See [chatbot-knowledge.md](chatbot-knowledge.md) for the current architecture. The sections below describe
> the original endpoints, environment variables and limits, which still apply.

Public website only (mounted in the home page, not in `/front-office`). Guests chat with a floating robot at the bottom-right.

## Flow
Browser → `POST /api/chat` → `chatService` → `aiService` (AI provider). The browser never talks to the AI provider and never sees the key.

- **Quick-question buttons** (availability, prices, check-in/out, breakfast, house rules, cancellation, contact) return **fixed trusted answers** from `backend/config/propertyFacts.js`. No AI call, so they cannot be wrong or cost money.
- **Typed questions** go to the AI with a strict system prompt and the trusted facts. The AI may only answer from those facts. If it does not know, it sends the guest to the front desk. If the AI is not configured or fails, the guest gets an answer from the approved knowledge, or the safe "call the front desk" reply.
- **Availability** is never guessed. Live results are read from the database and given to the AI, which also has a `check_availability` tool, which uses the same conflict rules as Front Office (`services/bookingConflictService.js`): only CONFIRMED bookings block, dates are `[checkIn, checkOut)`, a FLAT booking blocks all rooms of its flat. The tool result contains only free room keys and flats. No guest names, phones or booking details.
- The bot never creates or confirms a booking. "Book a Room" scrolls to the existing booking form (`#booking`). The front desk confirms.

## Endpoints (public, no login)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/chat` | body `{ messages: [{role, content}], quickQuestion? }`. Guest message ≤ 500 chars, ≤ 20 messages received, last 10 sent to the AI. 20 requests/min/IP. Returns `{ reply, fallback }`. |
| GET | `/api/public/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&roomType=master\|queen\|twin` | Returns `{ checkIn, checkOut, available, rooms:[{flatId, roomKey, roomType}], flats:[{flatId}] }`. Max 30 nights, no past dates. 30 requests/min/IP. |

## Environment variables (`backend/.env`, never in the frontend or GitHub)
| Variable | Required | Meaning |
|---|---|---|
| `GEMINI_API_KEY` | for AI answers | Google Gemini API key (free key from https://aistudio.google.com/apikey). Without it the bot still answers from the approved Kolam knowledge; quick questions always work. |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-lite-latest` (Google's alias for its current Flash-Lite model; free tier). Tested with a real key: `gemini-3.5-flash-lite` hung or returned 503 "high demand", and `gemini-2.5-*` return 404 for new users. |
| `GEMINI_BASE_URL` | no | Defaults to `https://generativelanguage.googleapis.com` (used by tests/proxies). |
| `CHAT_RATE_LIMIT_MAX`, `PUBLIC_RATE_LIMIT_MAX` | no | Override the per-minute limits (used by tests). |

Provider: Google Gemini, via the official `generateContent` REST API called with plain `fetch` (no SDK installed, nothing stored by the API between requests). The key is sent in the `x-goog-api-key` header and never appears in a URL, a log or a reply. `backend/services/aiService.js` is the only file that knows the provider; to change it, edit that file only. If the key is missing, or Gemini fails, times out or rate-limits, the guest gets an answer from the approved knowledge (see `chatbot-knowledge.md`) and no provider error is shown.

## Keeping facts correct
`backend/config/propertyFacts.js` mirrors the rates and times in `frontend/src/data/kolamConfig.js` and the phone number in the site's Contact section. A test fails if the rates drift. If you change prices or policy, update both files.

## Known limits
- Cancellation answers repeat the supplied rules and send guests to the front desk for exact refunds (the rules overlap; see `booking-policy.md`).
- Rate limit is in memory (per server process).
- Conversation lives only in the guest's browser tab; nothing is stored.
- Free-text answer quality depends on the AI model; the facts and rules keep it grounded but cannot make an AI 100% perfect.
