// Replies the bot can give WITHOUT the AI, from approved sources only: complaint handling,
// guest situations (medical, long stay, family, NRI, wedding, parents) and answers retrieved
// from the approved knowledge. Used when the AI is not configured or temporarily fails, so the
// guest still gets a sensible, honest answer.

const { FACTS } = require("../config/propertyFacts");
const { KNOWLEDGE, retrieve } = require("../knowledge/retriever");

const inr = (amount) => `₹${amount.toLocaleString("en-IN")}`;
const chunkText = (id) => KNOWLEDGE.find((chunk) => chunk.id === id).text;
const phone = FACTS.phone;

// --- complaints: apologise, guide, send to the Front Office. We cannot contact staff from chat. ---
const COMPLAINT_REPLIES = {
  ac: `I'm sorry the AC isn't working. This needs help from our Front Office / caretaker team, so please call the front desk on ${phone} right away and mention your flat and room number so they can assist you.`,
  hot_water: `I'm sorry about the hot water problem. Please call our front desk on ${phone} right away with your flat and room number so the Front Office / caretaker team can sort it out for you.`,
  wifi: `I'm sorry the Wi-Fi isn't working for you. Please call our front desk on ${phone}; the team can check the connection and help you get back online.`,
  cleaning: `I'm sorry your room hasn't been cleaned. Please call our front desk on ${phone} with your flat and room number so the Front Office / caretaker team can arrange it.`,
  key: `I'm sorry to hear you've lost your key. Please call our front desk on ${phone} so the team can help you right away. For your information, a lost room key is charged at ${inr(FACTS.rates.lostKey)}.`,
  forgot: `Please call our front desk on ${phone} and tell them your flat and room number and what you left behind, so the team can check for you. I can't contact the staff from this chat, so a call is the quickest way.`,
  generic: `I'm sorry you're facing this issue. It needs assistance from our Front Office / caretaker team, so please call the front desk on ${phone} and they will help you right away. I can't contact them from this chat.`,
};

const complaintReply = (type) => COMPLAINT_REPLIES[type] || COMPLAINT_REPLIES.generic;

// --- guest situations ---
const SITUATION_ORDER = ["medical", "wedding", "nri", "long_stay", "group", "family", "parents"];

const ACK = {
  medical: "I'm sorry to hear that, and I hope the treatment goes smoothly. ",
  wedding: "Congratulations on the wedding! ",
  nri: "Welcome, and thank you for considering Kolam Gandhi. ",
};

const primarySituation = (ctx) => SITUATION_ORDER.find((tag) => ctx.situationsLatest.includes(tag)) || null;

// A short opening line to put before an availability result.
const situationAck = (ctx) => ACK[primarySituation(ctx)] || "";

const groupText = (ctx) => {
  const who = ctx.guestCount ? `${ctx.guestCount} guests` : "a group";
  return `For ${who}, you could take more than one room in the same flat, or the entire 3BHK flat so everyone stays together (entire-flat rates are ${inr(FACTS.rates.flatSingle)} for single occupancy and ${inr(FACTS.rates.flatDouble)} for double occupancy). Our front desk will confirm the best arrangement.`;
};

const askMissing = (ctx) => {
  if (ctx.stay?.needsCheckout) return "Which date will you check out?";
  return ctx.guestCount
    ? "If you share your check-in and check-out dates, I can check the available room options."
    : "If you share your check-in and check-out dates and the number of guests, I can check the available room options.";
};

const situationReply = (ctx) => {
  const primary = primarySituation(ctx);
  const body = {
    medical: () => chunkText("medical"),
    wedding: () => chunkText("wedding-group"),
    nri: () => chunkText("nri"),
    long_stay: () => chunkText("long-stay"),
    group: () => groupText(ctx),
    family: () => (ctx.guestCount >= 4 ? groupText(ctx) : chunkText("families")),
    parents: () => chunkText("parents"),
  }[primary]();
  return `${ACK[primary] || ""}${body}\n\n${askMissing(ctx)}`;
};

// --- approved knowledge (official website + operational rules) ---
// Returns the best-matching chunk text, or null when nothing relevant was found.
const knowledgeReply = (ctx) => {
  const hits = retrieve(ctx.thread.join(" "), { situations: ctx.situations, limit: 1, minScore: 3 });
  return hits.length ? hits[0].chunk.text : null;
};

module.exports = { complaintReply, situationReply, situationAck, knowledgeReply, primarySituation };
