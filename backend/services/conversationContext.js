// Understands the current request from the guest's own messages (never from the bot's text):
// dates, room preference, number of guests / occupancy, the guest's situation (medical stay,
// long stay, family, NRI, wedding, parents) and complaints. Pure functions, no database.
//
// "Thread": the current request is the latest sentence plus the short replies that follow it
// ("2 people", "Queen", "22 Oct"). Older, separate questions are NOT carried into a new request.

const {
  parseStayDates,
  detectRoomType,
  detectOccupancy,
  wantsEntireFlat,
  mentionsDoubleRoom,
  mentionsStay,
  isDateReply,
} = require("./dateParser");

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const NUM = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)";
const toNumber = (value) => (/^\d+$/.test(value) ? Number(value) : NUM_WORDS[value.toLowerCase()]);

// How many people? ("family of 5", "we are 6", "2 people", "me and my wife", "just me")
const detectGuestCount = (text) => {
  const t = text.toLowerCase();
  let m = t.match(new RegExp(`\\bfamily of ${NUM}\\b`));
  if (m) return toNumber(m[1]);
  m = t.match(new RegExp(`\\b${NUM}\\s*(?:people|persons?|guests?|adults?|pax|members|of us)\\b`));
  if (m) return toNumber(m[1]);
  m = t.match(new RegExp(`\\bwe are ${NUM}\\b(?!\\s*(?:nights?|days?|weeks?|months?))`));
  if (m) return toNumber(m[1]);
  if (/\b(me and my (wife|husband|friend|mother|father|parents?|spouse|partner)|my (wife|husband) and i|couple)\b/.test(t)) return 2;
  if (/\b(just me|only me|alone|solo)\b/.test(t)) return 1;
  return null;
};

// A bare reply to "how many guests?": "2", "two people", "family of 5", "just me".
const isGuestReply = (text) => {
  const t = text.trim();
  return (
    new RegExp(`^(?:just\\s+)?${NUM}(?:\\s*(?:people|persons?|guests?|adults?|pax|members))?\\s*[.!?]*$`, "i").test(t) ||
    new RegExp(`^family of ${NUM}\\s*[.!?]*$`, "i").test(t) ||
    /^(just me|only me|me and my (wife|husband)|couple)\s*[.!?]*$/i.test(t)
  );
};

// A bare reply to "which room type?": "Queen", "master room please".
const isRoomTypeReply = (text) => {
  const t = text.trim();
  return detectRoomType(t) !== null && t.split(/\s+/).length <= 3 && !t.includes("?");
};

// "what about Oct 20 to 22?", "and Twin?": a follow-up to the previous request.
const CONTINUATION = /^(what|how) about\b|^and\b|^also\b|^same\b|^instead\b|^then\b/i;

const isFragment = (text) => isDateReply(text) || isGuestReply(text) || isRoomTypeReply(text) || CONTINUATION.test(text.trim());

// Length of a stay mentioned in words ("3 weeks", "10 days", "one month"), in days.
const detectDurationDays = (text) => {
  const m = text.toLowerCase().match(/\b(\d{1,3}|an?|one|two|three|four|five|six)\s*(day|days|night|nights|week|weeks|month|months)\b/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : m[1] === "a" || m[1] === "an" ? 1 : NUM_WORDS[m[1]];
  const unit = m[2];
  if (unit.startsWith("week")) return n * 7;
  if (unit.startsWith("month")) return n * 30;
  return n;
};

// Guest situations. A message can have several; the reply picks the most important one.
const detectSituations = (text) => {
  const t = text.toLowerCase();
  const tags = [];
  const count = detectGuestCount(t);
  const days = detectDurationDays(t);

  // A medical stay is a purpose ("treatment", "appointment"), or a hospital/Apollo named together
  // with a need to stay. "Is Apollo nearby?" or "hospital near ah?" is only a location question.
  const medicalPurpose = /\b(treatment|surgery|operation|patient|appointment|dialysis|therapy|chemo|cancer|medical|check-?up|admitted|discharge)\b/.test(t);
  const medicalPlace = /\b(apollo|proton|hospital)\b/.test(t);
  const needsStay = /\b(stay|staying|accommodation|room|rooms|lodging|place to stay|need a place|coming|visiting|book|booking)\b/.test(t);
  if (medicalPurpose || (medicalPlace && needsStay)) tags.push("medical");
  if (/\b(wedding|marriage|reception|engagement|function)\b/.test(t)) tags.push("wedding");
  if (/\b(nri|coming from (the )?(us|usa|uk|america|canada|australia|dubai|singapore|abroad|overseas)|from (the )?(us|usa|uk|america|canada|australia|dubai|singapore)|returning to (india|chennai)|relocat\w+)\b/.test(t)) tags.push("nri");
  if ((days !== null && days >= 7) || /\b(long[\s-]?stay|extended stay|monthly|long term|few weeks)\b/.test(t)) tags.push("long_stay");
  if ((count !== null && count >= 4) || /\b(group|batch|team of)\b/.test(t)) tags.push("group");
  if (/\b(family|kids?|children|child|baby|grand(parents|mother|father))\b/.test(t)) tags.push("family");
  if (/\b(parents?|mother|father|mom|dad|in-?laws?|grand(parents|mother|father)|senior citizens?|elderly)\b/.test(t)) tags.push("parents");
  return [...new Set(tags)];
};

// Service problems. Returns a type or null.
const detectComplaint = (text) => {
  const t = text.toLowerCase();
  if (/\b(lost|lose|misplaced|missing)\b.*\bkey\b|\bkey\b.*\b(lost|missing|misplaced)\b|locked out|forgot (my )?key/.test(t)) return "key";
  if (/\b(forgot|left|lost)\b.*\b(in the room|in my room|in room|at the (room|apartment|flat)|behind|something)\b/.test(t)) return "forgot";
  if (/\b(ac|a\/c|air[\s-]?condition\w*)\b.*\b(not working|not cooling|broken|issue|problem|noisy|not on|stopped)\b|\b(not working|not cooling)\b.*\b(ac|a\/c)\b/.test(t)) return "ac";
  if (/\bno hot water\b|\bhot water\b.*\b(not|issue|problem|no)\b|\bgeyser\b.*\b(not|issue|problem)\b/.test(t)) return "hot_water";
  if (/\b(wi-?fi|internet)\b.*\b(not working|slow|down|issue|problem|not connecting|not available)\b|\bno (wi-?fi|internet)\b/.test(t)) return "wifi";
  if (/\b(not|never|haven'?t|hasn'?t|isn'?t|wasn'?t)\s+(been\s+)?clean(ed)?\b|\bdirty\b|\bhousekeeping\b.*\b(not|issue|problem)\b/.test(t)) return "cleaning";
  if (/\b(not working|broken|leak\w*|no water|power (cut|outage)|too noisy|complain\w*|problem with|issue with|stopped working)\b/.test(t)) return "generic";
  return null;
};

// The thread = latest sentence + the short replies after it (newest last).
const buildThread = (userTexts) => {
  const thread = [];
  for (let i = userTexts.length - 1; i >= 0 && thread.length < 6; i -= 1) {
    thread.unshift(userTexts[i]);
    if (!isFragment(userTexts[i])) break; // a full sentence starts the request
  }
  return thread;
};

// Dates from the newest message in the thread that contains any date (so a newer date wins).
const findStay = (thread, todayKey) => {
  for (let i = thread.length - 1; i >= 0; i -= 1) {
    if (parseStayDates([thread[i]], todayKey)) return parseStayDates(thread.slice(0, i + 1), todayKey);
  }
  return null;
};

const newestFirst = (thread, fn) => {
  for (let i = thread.length - 1; i >= 0; i -= 1) {
    const value = fn(thread[i]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

const buildContext = (userTexts, todayKey) => {
  const latest = userTexts[userTexts.length - 1] || "";
  const thread = buildThread(userTexts);

  const guestCount = newestFirst(thread, (t) => detectGuestCount(t) ?? (isGuestReply(t) ? toNumber(t.match(new RegExp(NUM, "i"))?.[1] || "") || null : null));
  let occupancy = newestFirst(thread, detectOccupancy);
  if (!occupancy && guestCount === 1) occupancy = "single";
  if (!occupancy && guestCount === 2) occupancy = "double";

  const situations = [...new Set(thread.flatMap(detectSituations))];

  return {
    latest,
    thread,
    stay: findStay(thread, todayKey),
    roomType: newestFirst(thread, detectRoomType),
    occupancy,
    guestCount,
    flatWanted: thread.some(wantsEntireFlat),
    doubleRoomMentioned: thread.some(mentionsDoubleRoom),
    situations,
    situationsLatest: detectSituations(latest),
    durationDays: newestFirst(thread, detectDurationDays),
    // The request is about a room/stay if the thread says so or describes a stay situation.
    aboutStay: thread.some(mentionsStay) || situations.length > 0,
    complaint: detectComplaint(latest),
  };
};

module.exports = {
  buildContext,
  buildThread,
  detectGuestCount,
  detectSituations,
  detectComplaint,
  detectDurationDays,
  isGuestReply,
  isRoomTypeReply,
  isFragment,
};
