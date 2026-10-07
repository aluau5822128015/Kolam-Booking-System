# Guest Chatbot (KOLAM Assistant)

Public website only (mounted in the home page, not in `/front-office`). Guests chat with a floating robot at the bottom-right.

## Flow
Browser → `POST /api/chat` → `chatService` → `aiService` (AI provider). The browser never talks to the AI provider and never sees the key.

- **Quick-question buttons** (availability, prices, check-in/out, breakfast, house rules, cancellation, contact) return **fixed trusted answers** from `backend/config/propertyFacts.js`. No AI call, so they cannot be wrong or cost money.
- **Typed questions** go to the AI with a strict system prompt and the trusted facts. The AI may only answer from those facts. If it does not know, it sends the guest to the front desk. If the AI is not configured or fails, the guest gets the same safe "call the front desk" reply.
- **Availability** is never guessed. The AI must call the `check_availability` tool, which uses the same conflict rules as Front Office (`services/bookingConflictService.js`): only CONFIRMED bookings block, dates are `[checkIn, checkOut)`, a FLAT booking blocks all rooms of its flat. The tool result contains only free room keys and flats. No guest names, phones or booking details.
- The bot never creates or confirms a booking. "Book a Room" scrolls to the existing booking form (`#booking`). The front desk confirms.

## Endpoints (public, no login)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/chat` | body `{ messages: [{role, content}], quickQuestion? }`. Guest message ≤ 500 chars, ≤ 20 messages received, last 10 sent to the AI. 20 requests/min/IP. Returns `{ reply, fallback }`. |
| GET | `/api/public/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&roomType=master\|queen\|twin` | Returns `{ checkIn, checkOut, available, rooms:[{flatId, roomKey, roomType}], flats:[{flatId}] }`. Max 30 nights, no past dates. 30 requests/min/IP. |

## Environment variables (`backend/.env`, never in the frontend or GitHub)
| Variable | Required | Meaning |
|---|---|---|
| `AI_API_KEY` | for AI answers | Provider API key. Without it, typed questions get the safe front-desk reply; quick questions still work. |
| `AI_MODEL` | no | Defaults to `claude-haiku-4-5-20251001`. |
| `AI_BASE_URL` | no | Defaults to `https://api.anthropic.com` (used by tests/proxies). |
| `CHAT_RATE_LIMIT_MAX`, `PUBLIC_RATE_LIMIT_MAX` | no | Override the per-minute limits (used by tests). |

Provider: Anthropic Messages API called with plain `fetch` (no SDK installed). To change provider, edit `callProvider()` in `backend/services/aiService.js` only.

## Keeping facts correct
`backend/config/propertyFacts.js` mirrors the rates and times in `frontend/src/data/kolamConfig.js` and the phone number in the site's Contact section. A test fails if the rates drift. If you change prices or policy, update both files.

## Known limits
- Cancellation answers repeat the supplied rules and send guests to the front desk for exact refunds (the rules overlap; see `booking-policy.md`).
- Rate limit is in memory (per server process).
- Conversation lives only in the guest's browser tab; nothing is stored.
- Free-text answer quality depends on the AI model; the facts and rules keep it grounded but cannot make an AI 100% perfect.
