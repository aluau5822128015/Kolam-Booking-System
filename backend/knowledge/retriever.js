// Lightweight knowledge retrieval: keyword scoring over the approved chunks. No libraries,
// no embeddings. The question is normalised (simple Tanglish -> English), scored against each
// chunk's keywords, and the best chunks are returned. Situation tags from the conversation
// can boost related chunks.

const { KNOWLEDGE } = require("./kolamKnowledge");

// Common Tanglish / Indian-English phrasing -> plain English, so "parking iruka?" is
// understood as "parking is there?". Only used for understanding, never shown to the guest.
const TANGLISH = [
  [/\b(iruk+(?:a|aa|u|ku|kka|kkaa)|irukkum|irukkuma)\b/g, "is there"],
  [/\b(venum+|vendum|vennum)\b/g, "need"],
  [/\b(mudiyuma|mudiyum|mudiyatha|mudiyadha)\b/g, "can"],
  [/\b(panna|pannanum|pannalama|pannalaama|pannunga)\b/g, "do"],
  [/\b(evlo|evvalo|evalo|evlavu|how much ah)\b/g, "how much"],
  [/\b(ethana|ethanai|etthana)\b/g, "how many"],
  [/\b(enna|yenna)\b/g, "what"],
  [/\b(eppo|eppodhu|eppadi)\b/g, "when"],
  [/\b(pakkathula|pakathula|pakkathil|kitta|aruge)\b/g, "near"],
  [/\b(podhum|pothum)\b/g, "enough"],
  [/\b(illa|illai)\b/g, "no"],
  [/\b(irukku)\b/g, "is there"],
  [/\b(oru|oru naal)\b/g, "one"],
  [/\b(ah|aa|ga|la|nga)\b(?=\s*[?!.]*\s*$|\s)/g, " "],
];

const normalizeTanglish = (text) => {
  let t = String(text || "").toLowerCase();
  for (const [pattern, replacement] of TANGLISH) t = t.replace(pattern, replacement);
  return t.replace(/\s+/g, " ").trim();
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Situation tags (from the conversation) -> chunk ids that should be boosted.
const SITUATION_BOOST = {
  medical: ["medical", "apollo", "kitchen", "families", "long-stay"],
  long_stay: ["long-stay", "kitchen", "laundry", "discount"],
  family: ["families", "rooms", "entire-flat", "how-stay-works"],
  group: ["wedding-group", "entire-flat", "rooms"],
  nri: ["nri", "long-stay", "families"],
  wedding: ["wedding-group", "entire-flat", "rooms"],
  parents: ["parents", "families"],
};

const scoreChunk = (query, chunk) => {
  let score = 0;
  for (const keyword of chunk.keywords) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(keyword)}(s|es)?($|[^a-z0-9])`);
    if (pattern.test(query)) score += keyword.includes(" ") ? 4 : 3;
  }
  return score * (chunk.weight || 1);
};

// Returns up to `limit` chunks sorted by score, each with its score.
const retrieve = (text, { situations = [], limit = 4, minScore = 3 } = {}) => {
  const query = normalizeTanglish(text);
  const boosted = new Set(situations.flatMap((tag) => SITUATION_BOOST[tag] || []));

  return KNOWLEDGE.map((chunk) => {
    let score = scoreChunk(query, chunk);
    if (boosted.has(chunk.id)) score += score > 0 ? 3 : 2;
    return { chunk, score };
  })
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score || (b.chunk.priority || 0) - (a.chunk.priority || 0))
    .slice(0, limit);
};

module.exports = { retrieve, normalizeTanglish, KNOWLEDGE };
