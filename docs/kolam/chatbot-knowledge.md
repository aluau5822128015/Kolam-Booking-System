# Chatbot: Front Office Executive architecture and knowledge

The guest chatbot behaves like an experienced Front Office Executive for Kolam Gandhi. It does not rely on a list of
hard-coded questions: the AI (Google Gemini) understands the guest's intention, and the backend gives it only approved information.

## Request flow
```
Guest message (+ short history from the browser)
  -> validate (length, count, roles)                         chatService.validateChatBody
  -> quick-question button? fixed answer, no AI              QUICK_ANSWERS
  -> understand: Tanglish -> English, intent, conversation   retriever.normalizeTanglish, intentRouter, conversationContext
  -> greeting / thanks / clearly unrelated? friendly reply, no AI call
  -> AI configured?
       yes: build the prompt                                 frontOfficePrompt.buildSystemPrompt
              role + rules
              + TRUSTED OPERATIONAL FACTS  (propertyFacts.js, always)
              + OFFICIAL KOLAM KNOWLEDGE   (retrieved chunks for this question)
              + WHAT THE GUEST HAS ALREADY TOLD US (dates, guests, room preference, situation)
              + LIVE AVAILABILITY          (read from MongoDB for clear date requests)
            Gemini answers; it also has the check_availability tool for any other dates
       no / AI failed: answer from the same approved sources without the AI (chatFallback), never a guess
```

## Source priority (also stated in the AI prompt)
1. **MongoDB**: live availability only (`availabilityService` -> `bookingConflictService`; only CONFIRMED bookings block).
2. **`backend/config/propertyFacts.js`**: rates, check-in/out, policies, cancellation, house rules, contact. Authoritative.
3. **`backend/knowledge/kolamKnowledge.js`**: general property information from the official website.
4. **The AI's reasoning (Gemini)**: understanding, explaining, recommending. Never inventing.

## Knowledge layer (`backend/knowledge/`)
- `kolamKnowledge.js`: small chunks (id, title, keywords, text, type). Types: `official` (website),
  `operational` (built from propertyFacts, so rates cannot drift), `process` (how to book).
- `retriever.js`: keyword scoring, no libraries or embeddings. Simple Tanglish ("parking iruka?", "room venum",
  "mudiyuma") is normalised for understanding only; the guest's original wording still goes to the AI.
- To change an answer: edit the chunk text/keywords, or the rule in `propertyFacts.js`, and run `npm test`.

## Official website content (captured 2026-10-07 from https://kolamapartments.com/kolam-gandhi/)
Positioning (families, NRIs, medical stays, weddings, parents visiting, relocating), facilities (spacious rooms, kitchen,
Wi-Fi, AC, parking, washing machine, TV/living room, gated 24/7 security, CCTV), FAQ answers, and nearby places with
approximate times: Apollo Proton Cancer Centre ~5 min drive, IIT Madras ~10, Besant Nagar Beach ~8, Ramachandra
Convention Hall ~10, MRC Centre ~12, Phoenix Marketcity ~15, Chennai Airport ~25, Adyar Bus Terminus ~5 min walk.
The page was read with an automated fetch: **please have a team member review `kolamKnowledge.js` once.**

## Conflicts found between the website and the operational rules (operational rules win)
| Topic | Official website | Operational rules (used) |
|---|---|---|
| Lunch / dinner | "available on request" | currently unavailable |
| Check-in / out | "flexible check-in/out for medical stays"; times not stated | 12:00 PM / 11:00 AM; early check-in Rs 1,680 subject to availability. The bot does not promise flexibility and suggests asking the front desk |
| WhatsApp | +91 95000 25466 | the website's Contact section and the rules use +91 87544 15469. **Please confirm which WhatsApp number is correct** |
| Long-stay pricing | "special pricing for 7+ nights" | not in the rate card. The bot may mention that the website says so, never quotes a discount; the front desk gives the quote |
| Booking link | external booking engine | not used; guests are sent to the booking form / front desk |

## Guest situations (conversationContext.js)
Medical stay, long stay (7+ days), family/group (4+ guests), NRI, wedding, parents. They shape the retrieved knowledge,
the prompt hints and the fallback replies. Complaints (AC, hot water, cleaning, lost key, Wi-Fi, forgotten items) are
acknowledged and sent to the Front Office; the bot never claims to have contacted staff.

## Conversation context
The current request is the latest full sentence plus the short replies after it ("2 people", "Queen", "22 Oct").
Dates, guests and room preference are carried inside that request only; an older, separate question is never carried
into a new one. Context is built only from the guest's own words, never from the assistant's text.

## Limits
- Free-text quality with Gemini depends on the model and cannot be fully tested without a real `GEMINI_API_KEY`.
- Without an AI key, or if it fails, the bot answers common questions from approved sources; unusual phrasing may get
  "I don't have the correct information, please call the front desk".
- Distances exist only for the places the official page lists; anything else is not guessed.
- Keyword retrieval can miss very unusual wording; extend the chunk keywords when you see a miss.
