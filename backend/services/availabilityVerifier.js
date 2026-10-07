// Checks what the AI says about availability against the database result.
//
// The numbers always come from availabilityService (through chatAvailability snapshots), never
// from the AI. After the AI answers, the WHOLE reply is read clause by clause and every
// availability claim about Master, Queen, Twin and the Entire Flat is compared with the
// database, whichever room type the guest asked about:
//   - a wrong count, or "available" for something that has none  -> the reply is replaced by the
//     deterministic availability answer;
//   - a correct reply that leaves a count out                      -> the counts are appended;
//   - nothing free anywhere                                        -> the reply may not claim any
//     availability and must say nothing is free (otherwise it is replaced).
// Numbers are only read as counts when they are clearly about rooms (see the patterns below), so
// prices, guest counts and bed counts are left alone.
//
// Snapshots come from the pre-fetch for the guest's dates and from every check_availability call
// the AI itself made. A claim is accepted if it matches ANY of them (the guest may have asked
// about several date ranges); "available" is a contradiction only when every snapshot says zero.

const { formatAvailabilityReply, countLines, askDatesReply } = require("./chatAvailability");

const NUMBER_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUM = String.raw`(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`;
const toCount = (token) => (/^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token.toLowerCase()]);

const TYPE_KEY = { master: "king", queen: "queen", twin: "twin" };
const ROOM_NOUN = String.raw`(?:rooms?|bedrooms?|suites?)`;
const FLAT_NOUN = String.raw`(?:flats?|apartments?|units?)`;
const FLAT_QUAL = String.raw`(?:(?:entire|whole|full)\s+)?(?:3\s*bhk\s+)?`;
const NOT_PRICE = String.raw`(?<![\d,.₹$])`;

// "4 Master rooms", "6 of our Master bedrooms", "4 free Queen rooms"
const TYPE_BEFORE = new RegExp(String.raw`${NOT_PRICE}\b${NUM}\b\s+(?:(?:more|free|available|vacant|remaining|spare)\s+)*(?:of\s+(?:our|the|these|those)\s+)?(master|queen|twin)\s+${ROOM_NOUN}\b`, "gi");
// "4 entire flats", "6 entire apartments", "4 flats free"
const FLAT_BEFORE = new RegExp(String.raw`${NOT_PRICE}\b${NUM}\b\s+(?:(?:more|free|available|vacant|remaining|spare)\s+)*(?:of\s+(?:our|the|these|those)\s+)?${FLAT_QUAL}${FLAT_NOUN}\b`, "gi");
// "4 of 6 Master rooms", "4 out of our 6 flats"
const FRACTION = new RegExp(String.raw`${NOT_PRICE}\b${NUM}\b\s+(?:out\s+of|of)\s+(?:our\s+|the\s+)?(?:total\s+)?(?:\d{1,2}|${NUM.slice(1, -1)})\s+(?:(master|queen|twin)\s+)?(${ROOM_NOUN}|${FLAT_NOUN})\b`, "gi");
// "Master Room: 4 rooms available", "Queen - 4 available", "Master and Queen rooms: 4 each", "Entire Flat: 4 flats"
const LABEL_TYPE = String.raw`(?:master|queen|twin)(?:\s+${ROOM_NOUN})?`;
const LABEL_FLAT = String.raw`(?:(?:entire|whole|full)\s+(?:3\s*bhk\s+)?${FLAT_NOUN}|3\s*bhk(?:\s+${FLAT_NOUN})?|${FLAT_NOUN})`;
const LABEL_AFTER = new RegExp(
  String.raw`\b(${LABEL_TYPE}(?:\s*(?:,|and|&)\s*${LABEL_TYPE})*|${LABEL_FLAT})\s*(?::|-|–|—|\()\s*${NUM}\b(?![,.]?\d)` +
    String.raw`(?=\s*(?:each\b|more\b|of\s+\d|${ROOM_NOUN}\b|${FLAT_NOUN}\b|available\b|free\b|left\b|vacant\b|open\b|remaining\b|[.,;)!?\n]|$))`,
  "gi"
);

const STRONG_CONTEXT = /\b(available|vacant|free|left|remaining|open)\b/i;
const SOFT_CONTEXT = /\b(we have|we've got|we have got|there (?:is|are)|currently|right now|for (?:those|these|your) dates|on those dates)\b/i;
const INVENTORY = /\b(in total|in all|altogether|overall|each flat|every flat|per flat)\b/i;
const NEGATION = /\b(no|not|none|nothing|nor|unavailable|sold\s+out|fully\s+booked|booked\s+out|cannot|can't|without|unfortunately|sorry|zero)\b|n't\b|\b0\b/i;
// "available"/"vacant" said about something (a clause that is not about booking mechanics).
const AVAILABLE_WORD = /\b(available|vacant)\b|\b(?:is|are|still|currently|all) free\b|\bfree (?:for|on|from|during|between|these|those|your)\b|\bopen for (?:booking|your)\b/i;
const ROOMISH = /\b(rooms?|bedrooms?|flats?|apartments?|suites?|accommodation|3\s*bhk|master|queen|twin|dates|stay)\b/i;
const AFFIRM_HAVE = /\bwe (?:do )?have (?:\w+\s+){0,3}(?:rooms?|flats?|apartments?)\b/i;
const NOTHING_FREE = /\b(nothing|no rooms?|no flats?|no availability|no vacanc\w+|not available|unavailable|fully booked|sold out|booked out|none (?:of|are)|no free)\b/i;

const MENTIONS = [
  ["king", /\bmaster\b/i],
  ["queen", /\bqueen\b/i],
  ["twin", /\btwin\b/i],
  ["flat", /\b(?:flats?|apartments?|3\s*bhk)\b/i],
];

const CLAUSE_SPLIT = /(?<=[.!?])\s+|\n+|;|\s+(?:but|however|although|though|while|whereas|except)\s+/i;

const keysOf = (label) => {
  const text = label.toLowerCase();
  const keys = ["master", "queen", "twin"].filter((word) => text.includes(word)).map((word) => TYPE_KEY[word]);
  return keys.length ? keys : ["flat"];
};

// All numeric claims in one clause: [{ key, count, strong }]
const numericClaims = (clause) => {
  const claims = [];
  const strong = STRONG_CONTEXT.test(clause);
  const countable = (strong || SOFT_CONTEXT.test(clause)) && !INVENTORY.test(clause);
  let work = clause;

  for (const match of work.matchAll(FRACTION)) {
    const noun = match[3].toLowerCase();
    const key = match[2] ? TYPE_KEY[match[2].toLowerCase()] : /^(?:flat|apartment|unit)/.test(noun) ? "flat" : null;
    if (key) claims.push({ key, count: toCount(match[1]), strong });
  }
  work = work.replace(FRACTION, (m) => " ".repeat(m.length));

  for (const match of work.matchAll(LABEL_AFTER)) {
    const count = toCount(match[2]);
    for (const key of keysOf(match[1])) claims.push({ key, count, strong });
  }
  work = work.replace(LABEL_AFTER, (m) => " ".repeat(m.length));

  if (countable) {
    for (const match of work.matchAll(TYPE_BEFORE)) claims.push({ key: TYPE_KEY[match[2].toLowerCase()], count: toCount(match[1]), strong });
    for (const match of work.matchAll(FLAT_BEFORE)) claims.push({ key: "flat", count: toCount(match[1]), strong });
  }
  return claims;
};

const countFor = (snapshot, key) => (key === "flat" ? snapshot.flatFree : snapshot.allByType[key]);

// reply: the AI's text. snapshots: every database availability result this reply could be about
// (the first is the one the counts are shown for). Returns the text to send to the guest.
const verifyAvailabilityReply = ({ reply, snapshots, ctx }) => {
  const clauses = reply.split(CLAUSE_SPLIT).filter((clause) => clause && clause.trim());
  const claims = [];
  const qualitative = [];
  let genericAffirmative = false;
  let strongNumeric = false;

  for (const clause of clauses) {
    const numeric = numericClaims(clause);
    claims.push(...numeric);
    if (numeric.some((claim) => claim.strong)) strongNumeric = true;

    if (!NEGATION.test(clause)) {
      const said = AVAILABLE_WORD.test(clause);
      for (const [key, pattern] of MENTIONS) {
        if (said && pattern.test(clause) && !numeric.some((claim) => claim.key === key)) qualitative.push(key);
      }
      if ((said && ROOMISH.test(clause)) || AFFIRM_HAVE.test(clause)) genericAffirmative = true;
    }
  }

  // No database result at all: the AI cannot know counts. Explicit "N rooms free" claims are dropped.
  if (snapshots.length === 0) {
    return strongNumeric ? askDatesReply(ctx) : reply;
  }

  const primary = snapshots[0];
  const keys = ["king", "queen", "twin", "flat"];
  const counts = (key) => snapshots.map((snapshot) => countFor(snapshot, key));
  const nothingFreeEverywhere = snapshots.every((snapshot) => keys.every((key) => countFor(snapshot, key) === 0));
  const replacement = () => formatAvailabilityReply(primary, ctx);

  // Wrong count, or "available" about something every snapshot says is fully booked.
  if (claims.some((claim) => !counts(claim.key).includes(claim.count))) return replacement();
  if (qualitative.some((key) => counts(key).every((n) => n === 0))) return replacement();

  if (nothingFreeEverywhere) {
    // The guest must be told plainly that nothing is free, and nothing may suggest otherwise.
    const zeroStated = keys.every((key) => claims.some((claim) => claim.key === key && claim.count === 0));
    if (genericAffirmative || !(NOTHING_FREE.test(reply) || zeroStated)) return replacement();
    return reply;
  }

  // Correct so far: every shown count must be stated; add them from the database if not.
  const lines = countLines(primary, ctx);
  const stated = (line) => claims.some((claim) => claim.key === line.key && claim.count === line.expected);
  if (lines.every(stated)) return reply;
  return `${reply.trimEnd()}\n\nLive availability for ${primary.span}:\n${lines.map((line) => line.text).join("\n")}`;
};

module.exports = { verifyAvailabilityReply, numericClaims };
