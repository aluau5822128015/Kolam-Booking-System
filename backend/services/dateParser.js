// Reads stay dates and a room type out of a guest's chat message. Pure functions, no database.
// Understands: "10 Dec to 12 Dec", "Dec 10 - Dec 12 2026", "2026-12-10 to 2026-12-12",
// "10/12 to 12/12" (day/month), "tomorrow for 2 nights", "today", "day after tomorrow".
// Dates without a year use the next upcoming date. Anything it cannot read returns null,
// so the caller can ask the guest for clearer dates instead of guessing.

const MONTH_NAMES = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const pad = (n) => String(n).padStart(2, "0");
const toKey = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const isRealDate = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};
const addDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// Finds date mentions in order. Each is { index, end, y|null, m, d } or { index, end, key } (relative words).
const findDateMentions = (text, todayKey) => {
  const found = [];
  const overlaps = (index, end) => found.some((f) => index < f.end && end > f.index);
  const add = (match, build) => {
    const item = build(match);
    if (!item) return;
    const index = match.index;
    const end = index + match[0].length;
    if (overlaps(index, end)) return;
    found.push({ index, end, ...item });
  };
  const run = (regex, build) => {
    for (const match of text.matchAll(regex)) add(match, build);
  };

  // "10-12 Dec", "10 to 12 December 2026": two days in the same month.
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|to|till|until)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH_RE}\\b\\.?(?:,?\\s*(\\d{4}))?`, "gi"))) {
    const index = match.index;
    const end = index + match[0].length;
    if (overlaps(index, end)) continue;
    const month = MONTH_NAMES[match[3].toLowerCase()];
    const y = match[4] ? +match[4] : null;
    const mid = index + match[1].length + 1;
    found.push({ index, end: mid, y, m: month, d: +match[1] });
    found.push({ index: mid, end, y, m: month, d: +match[2] });
  }
  // "Oct 16 to 18", "October 16th - 18th", "Oct 16–18": month first, then a bare second day.
  for (const match of text.matchAll(new RegExp(`\\b${MONTH_RE}\\b\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:-|–|—|to|till|until|through|thru)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "gi"))) {
    const index = match.index;
    const end = index + match[0].length;
    if (overlaps(index, end)) continue;
    const month = MONTH_NAMES[match[1].toLowerCase()];
    const y = match[4] ? +match[4] : null;
    const mid = index + 1; // the two dates together cover the whole match; only their order matters
    found.push({ index, end: mid, y, m: month, d: +match[2] });
    found.push({ index: mid, end, y, m: month, d: +match[3] });
  }
  run(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (m) => ({ y: +m[1], m: +m[2], d: +m[3] }));
  run(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH_RE}\\b\\.?(?:,?\\s*(\\d{4}))?`, "gi"), (m) => ({
    y: m[3] ? +m[3] : null, m: MONTH_NAMES[m[2].toLowerCase()], d: +m[1],
  }));
  run(new RegExp(`\\b${MONTH_RE}\\b\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s*(\\d{4}))?`, "gi"), (m) => ({
    y: m[3] ? +m[3] : null, m: MONTH_NAMES[m[1].toLowerCase()], d: +m[2],
  }));
  run(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g, (m) => {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    return { y, m: +m[2], d: +m[1] }; // day/month, as written in India
  });
  run(/\bday after tomorrow\b/gi, () => ({ key: addDays(todayKey, 2) }));
  run(/\btomorrow\b/gi, () => ({ key: addDays(todayKey, 1) }));
  run(/\btoday\b/gi, () => ({ key: todayKey }));

  return found.sort((a, b) => a.index - b.index);
};

// Turns mentions into full YYYY-MM-DD keys, filling in a missing year.
const resolveMentions = (mentions, todayKey) => {
  const todayYear = +todayKey.slice(0, 4);
  const explicitYear = mentions.find((x) => x.y)?.y || null;
  const keys = [];

  for (const x of mentions) {
    if (x.key) { keys.push(x.key); continue; }
    if (x.m < 1 || x.m > 12 || x.d < 1 || x.d > 31) return null;
    let y = x.y || explicitYear;
    if (!y) {
      y = todayYear;
      if (isRealDate(y, x.m, x.d) && toKey(y, x.m, x.d) < todayKey) y += 1; // next upcoming
    }
    if (!isRealDate(y, x.m, x.d)) return null;
    keys.push(toKey(y, x.m, x.d));
  }

  // A check-out that lands before check-in with no explicit year means the next year.
  if (keys.length >= 2 && keys[1] < keys[0] && !mentions[1].y && !mentions[1].key) {
    const [y, m, d] = keys[1].split("-").map(Number);
    if (isRealDate(y + 1, m, d)) keys[1] = toKey(y + 1, m, d);
  }
  return keys;
};

const readNights = (text) => {
  const match = text.match(/\b(\d{1,2})\s*(?:nights?|days?)\b/i);
  return match ? +match[1] : null;
};

// One text -> { checkIn, checkOut } | { checkIn, needsCheckout: true } | null
const parseOne = (text, todayKey) => {
  const keys = resolveMentions(findDateMentions(text, todayKey), todayKey);
  if (!keys || keys.length === 0) return null;
  if (keys.length >= 2) return { checkIn: keys[0], checkOut: keys[1] };
  const nights = readNights(text);
  if (nights && nights > 0) return { checkIn: keys[0], checkOut: addDays(keys[0], nights) };
  return { checkIn: keys[0], needsCheckout: true };
};

// userTexts: the guest's recent messages, oldest first (only the guest's own words).
// If the latest message has just one date, it may complete a date given in the message before it.
const parseStayDates = (userTexts, todayKey) => {
  const latest = userTexts[userTexts.length - 1] || "";
  const first = parseOne(latest, todayKey);
  if (first && !first.needsCheckout) return first;

  const previous = userTexts.length > 1 ? parseOne(userTexts[userTexts.length - 2], todayKey) : null;
  if (previous && previous.needsCheckout && first && first.needsCheckout && first.checkIn > previous.checkIn) {
    return { checkIn: previous.checkIn, checkOut: first.checkIn };
  }
  if (previous && previous.needsCheckout && !first) return null;
  return first;
};

// "master"/"king" -> king (internal value). Returns null when the guest did not say.
const detectRoomType = (text) => {
  const t = text.toLowerCase();
  if (/\b(master|king)\b/.test(t)) return "king";
  if (/\bqueen\b/.test(t)) return "queen";
  if (/\btwin\b/.test(t)) return "twin";
  return null;
};

const wantsEntireFlat = (text) => /\b(entire|whole|full)\s+(flat|apartment|house)\b|\b(flat|apartment|3\s*bhk)\b/i.test(text);

// Occupancy is about price, not availability. Only explicit wording counts:
// "double occupancy", "2 people", "couple" -> "double"; "single occupancy", "1 person", "solo" -> "single".
// "double room" is NOT occupancy and NOT a room type. "for 2 nights" is not occupancy.
const detectOccupancy = (text) => {
  const t = text.toLowerCase();
  if (/\bdouble\s+occupancy\b|\b(2|two)\s+(guests?|people|persons?|adults?|pax)\b|\bcouple\b|\bfor\s+(2|two)\b(?!\s*(nights?|days?))/.test(t)) return "double";
  if (/\bsingle\s+occupancy\b|\b(1|one)\s+(guest|person|adult|pax)\b|\bsolo\b|\balone\b|\bfor\s+(1|one)\b(?!\s*(nights?|days?))/.test(t)) return "single";
  return null;
};

// True when the message is just dates ("22 Oct", "from 10 Oct to 12 Oct 2031", "tomorrow"),
// i.e. a reply to "what are your dates?" and not a question about something else.
const isDateReply = (text) =>
  text
    .toLowerCase()
    .replace(/(\d)(st|nd|rd|th)\b/g, "$1")
    .replace(new RegExp(`\\b${MONTH_RE}\\b`, "g"), "")
    .replace(/\b(from|to|till|until|through|thru|on|for|the|of|and|then|check[\s-]?in|check[\s-]?out|nights?|days?|today|tomorrow|day after|after|st|nd|rd|th|please|pls)\b/g, "")
    .replace(/[\d\s,.:/?!–—-]/g, "").length === 0;

const mentionsDoubleRoom = (text) => /\bdouble\s+(room|bed)s?\b/i.test(text);

// Does the message clearly talk about a room / flat / stay / booking?
const mentionsStay = (text) =>
  /\b(rooms?|flats?|apartments?|accommodations?|stay(?:ing)?|suites?|lodging|bookings?|book|reserve|reservations?|vacanc\w*|availab\w*)\b/i.test(text);

// "I want / need / looking for / do you have a room ..."
const wantsRoom = (text) =>
  !/^\s*(how many|how much|what|which|where|when|why|who)\b/i.test(text) && // information questions are not requests
  /\b(i want|i need|i'd like|we want|we need|looking for|do you have|have you got|can i get|can i have|can we get)\b/i.test(text) && mentionsStay(text);

module.exports = {
  parseStayDates,
  detectRoomType,
  detectOccupancy,
  isDateReply,
  mentionsDoubleRoom,
  mentionsStay,
  wantsRoom,
  wantsEntireFlat,
  addDays,
};
