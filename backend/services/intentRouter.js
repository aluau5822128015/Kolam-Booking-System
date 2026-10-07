// Simple keyword intent detection for the guest chatbot (no AI, no database).
// Used to (a) answer common questions when the AI is unavailable and (b) politely
// redirect clearly unrelated questions without spending an AI call.
// It is intentionally conservative: when unsure it says "ambiguous" and the AI decides.

const GREETING = /^(hi+|hello+|hey+|hai|hola|namaste|vanakkam|good (morning|afternoon|evening))\b[\s!.,?😊👋]*$/i;
const THANKS = /^(ok(ay)?[, ]*)?(thanks?|thank you|thankyou|thx|great,? thanks|bye|goodbye|see you)\b[\s!.,?😊]*$/i;

// Order matters: the first matching topic wins.
const TOPICS = [
  ["cancellation", /cancel|refund|money back/],
  ["availability", /availab|vacan|free (room|flat)|\bany rooms?\b|rooms? (free|open)/],
  ["booking", /\bbook(ing|ed)?\b|reserve|reservation/],
  ["checkin", /check[\s-]?(in|out)|checkout|arrival|arrive/],
  ["breakfast", /breakfast|\btea\b|coffee|lunch|dinner|meals?\b|food|menu|vegetarian|non[\s-]?veg/],
  ["rules", /house rules?|\brules?\b|smok|alcohol|liquor|\bpets?\b|\bdog|part(y|ies)\b|quiet hours?|visitor|photo|decorat|mehndi|makeup|celebrat/],
  ["prices", /price|pricing|\brates?\b|cost|charges?\b|tariff|how much|\bfee\b|₹|\brs\.?\b|extra bed|floor bed|damage/],
  ["contact", /contact|phone|\bcall\b|whatsapp|number|address|where (is|are)|location|how to reach|direction|front desk|e-?mail/],
  ["amenities", /wi-?fi|internet|parking|laundry|washing|kitchen|air[\s-]?condition|\bac\b|amenit|facilit|towel|family|long[\s-]?stay|living|dining/],
];

// Words that show the question is about Kolam / the stay even if no topic matched.
const KOLAM_WORDS = /kolam|\brooms?\b|\bflats?\b|apartment|\bstay(s|ing)?\b|guests?|property|adyar|chennai|master|queen|twin|\bbed(s)?\b|night/;

// Facility words, and words that show the question is about a room/stay, used to tell
// "Is parking available?" (facility) from "Is a room available?" (availability).
const FACILITY = /parking|wi-?fi|internet|laundry|washing|kitchen|breakfast|lunch|dinner|\btea\b|coffee|\bac\b|air[\s-]?condition|\btv\b|lift|elevator|\bfood\b|\bmeals?\b/;
const ROOMISH = /\b(rooms?|flats?|apartments?|accommodation|stay|queen|master|twin|king|suite|bhk)\b/;

// Words that always mean a Kolam question, even if an unrelated word is also present.
const STRONG_TOPIC = /cancel|refund|check[\s-]?(in|out)|breakfast|parking|laundry|kitchen|wi-?fi|availab|booking|reserve|smok|alcohol|\bpets?\b/;

// Clearly unrelated topics (only used when nothing Kolam-related was found).
const OFF_TOPIC =
  /\b(president|prime minister|minister|election|politic\w*|government|capital of|population|who (is|was|are|invented|discovered|made|created)|weather|temperature today|news|cricket|football|ipl|movie|film|song|lyrics|joke|poem|story|essay|homework|math|calculate|python|javascript|coding|code|program(ming)?|bitcoin|crypto|stock|share price|recipe|translate|horoscope|astrology|chatgpt|openai|gemini|claude|match|score|who won|apple|iphone|tesla|google|facebook|stocks?|sensex|nifty)\b|\d+\s*[+\-*/x]\s*\d+/i;

// Returns { kind: 'greeting' | 'thanks' | 'topic' | 'kolam' | 'out_of_scope' | 'ambiguous', topic? }
const classify = (text) => {
  const t = String(text || "").trim().toLowerCase();

  if (GREETING.test(t)) return { kind: "greeting" };
  if (THANKS.test(t)) return { kind: "thanks" };

  // Clearly unrelated ("stock price of Apple") must not be mistaken for a Kolam topic
  // just because it contains a word like "price".
  if (!KOLAM_WORDS.test(t) && !STRONG_TOPIC.test(t) && OFF_TOPIC.test(t)) return { kind: "out_of_scope" };

  for (const [topic, pattern] of TOPICS) {
    // "Is parking available?" asks about a facility, not about room availability.
    if (topic === "availability" && FACILITY.test(t) && !ROOMISH.test(t)) continue;
    if (pattern.test(t)) return { kind: "topic", topic };
  }

  if (KOLAM_WORDS.test(t)) return { kind: "kolam" };
  if (OFF_TOPIC.test(t)) return { kind: "out_of_scope" };
  return { kind: "ambiguous" };
};

module.exports = { classify };
