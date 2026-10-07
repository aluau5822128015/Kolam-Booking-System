// Unit tests for the knowledge retriever, Tanglish normalisation and conversation context.
// Pure functions: no server, no database, no AI.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { retrieve, normalizeTanglish, KNOWLEDGE } = require("../knowledge/retriever");
const {
  buildContext,
  detectGuestCount,
  detectSituations,
  detectComplaint,
  detectDurationDays,
  isGuestReply,
  isRoomTypeReply,
} = require("../services/conversationContext");
const { classify } = require("../services/intentRouter");
const { FACTS } = require("../config/propertyFacts");

const TODAY = "2026-10-07";
const top = (text, options) => retrieve(text, options)[0]?.chunk.id ?? null;

test("knowledge chunks are well formed and unique", () => {
  const ids = KNOWLEDGE.map((chunk) => chunk.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  for (const chunk of KNOWLEDGE) {
    assert.ok(chunk.title && chunk.text && chunk.keywords.length > 0, chunk.id);
    assert.ok(["official", "operational", "process"].includes(chunk.type), chunk.id);
  }
});

test("operational chunks stay in sync with propertyFacts (no second source of truth)", () => {
  const text = (id) => KNOWLEDGE.find((chunk) => chunk.id === id).text;
  assert.ok(text("early-checkin").includes("₹1,680"));
  assert.ok(text("late-checkout").includes("₹900"));
  assert.ok(text("extra-bed").includes("₹560"));
  assert.ok(text("key-damage").includes("₹300"));
  assert.ok(text("laundry").includes("₹105"));
  assert.ok(text("entire-flat").includes("₹11,655") && text("entire-flat").includes("₹12,600"));
  assert.ok(text("how-to-book").includes(FACTS.phone));
  assert.ok(text("meals").includes("currently unavailable"), "lunch/dinner status follows the operational rules");
});

test("official knowledge does not contradict the operational rules", () => {
  const all = KNOWLEDGE.map((chunk) => chunk.text).join(" ").toLowerCase();
  assert.ok(!/flexible check-?in/.test(all), "no promise of flexible check-in");
  assert.ok(!/lunch and dinner (are )?available/.test(all), "lunch/dinner are not offered as available");
  assert.ok(!/\d+\s*%\s*(discount|off)/.test(all), "no invented discount percentage");
});

test("property questions find the right chunk", () => {
  const cases = {
    "Tell me about Kolam Gandhi": "overview",
    "What kind of accommodation is this?": "overview",
    "Is it a hotel?": "overview",
    "Is it an apartment?": "overview",
    "How does the stay work?": "how-stay-works",
    "How many rooms do you have?": "rooms",
    "What types of rooms are there?": "rooms",
    "Do you have parking?": "parking",
    "Can I bring my car?": "parking",
    "Where can I park?": "parking",
    "Do you have WiFi?": "wifi",
    "Is Wi-Fi available?": "wifi",
    "Can I cook?": "kitchen",
    "Is there a kitchen?": "kitchen",
    "Is breakfast included?": "meals",
    "Do you have AC?": "ac",
    "Is there a living room?": "living-room",
    "Do you provide laundry?": "laundry",
    "Is it safe? Is there CCTV?": "security",
    "What facilities are available?": "amenities",
    "Is it suitable for families?": "families",
    "Is it suitable for senior citizens?": "families",
    "Is it good for long stays?": "long-stay",
    "Is it suitable for medical stays?": "medical",
    "Can wedding guests book multiple rooms?": "wedding-group",
    "Can I book the entire flat?": "entire-flat",
  };
  for (const [question, id] of Object.entries(cases)) assert.equal(top(question), id, question);
});

test("nearby questions use the official places and never invent distances", () => {
  const cases = {
    "How far is IIT Madras?": "iit",
    "Is Apollo Proton nearby?": "apollo",
    "How far is the airport?": "airport",
    "How far is Besant Nagar Beach?": "beach",
    "Is Phoenix Marketcity close?": "phoenix",
    "How far is Adyar Bus Terminus?": "bus-terminus",
    "Is the Ramachandra Convention Hall near?": "ramachandra",
    "How far is MRC Centre?": "mrc",
    "Is there a hospital nearby?": "hospitals",
    "How far is the railway station?": "nearby-unlisted",
    "Is there a metro station nearby?": "nearby-unlisted",
    "What places are near Kolam Gandhi?": "nearby",
  };
  for (const [question, id] of Object.entries(cases)) assert.equal(top(question), id, question);
  const approved = ["apollo", "iit", "beach", "ramachandra", "mrc", "phoenix", "bus-terminus", "airport"];
  for (const id of approved) {
    const text = KNOWLEDGE.find((chunk) => chunk.id === id).text;
    assert.ok(text.includes("official website"), id);
    // driving times vary with traffic; a walking time does not
    assert.equal(text.includes("traffic"), id !== "bus-terminus", id);
  }
  const unlisted = KNOWLEDGE.find((chunk) => chunk.id === "nearby-unlisted").text;
  assert.ok(!/\d+[- ]minute/.test(unlisted), "no distance is given for places that are not approved");
});

test("travel modes are preserved exactly: Adyar Bus Terminus is a WALK, every other place is a DRIVE", () => {
  const withoutNegation = (text) => text.replace(/not a drive/g, "");
  const byId = (id) => KNOWLEDGE.find((chunk) => chunk.id === id);

  // the walk place
  const bus = withoutNegation(byId("bus-terminus").text);
  assert.ok(/5-minute walk/.test(bus), "bus terminus is a 5-minute walk");
  assert.ok(!/drive|\bcar\b/i.test(bus), "bus terminus is never described as a drive or car distance");
  assert.equal(byId("bus-terminus").mode, "walk");

  // every other listed place is a drive, with the mode stated
  for (const id of ["apollo", "iit", "beach", "ramachandra", "mrc", "phoenix", "airport"]) {
    const text = byId(id).text;
    assert.equal(byId(id).mode, "drive", id);
    assert.ok(/-minute drive/.test(text) && !/walk/i.test(text), `${id} is stated as a drive`);
  }

  // the combined chunks keep the two modes in separate, labelled groups
  const nearby = byId("nearby").text;
  const [onFoot, byCar] = nearby.split("By car:");
  assert.ok(onFoot.includes("On foot:") && onFoot.includes("Adyar Bus Terminus") && /walk/.test(onFoot));
  assert.ok(!byCar.includes("Bus Terminus"), "the bus terminus is not listed among the car journeys");
  assert.ok(/Phoenix Marketcity about 15 minutes/.test(byCar) && /Chennai Airport about 25 minutes/.test(byCar));

  // in EVERY chunk, any sentence that gives Adyar Bus Terminus a time says walk, never drive/car
  for (const chunk of KNOWLEDGE) {
    for (const sentence of chunk.text.split(/(?<=[.)])\s+(?=[A-Z])/)) {
      if (sentence.includes("Bus Terminus") && /\d/.test(sentence)) {
        const parts = withoutNegation(sentence).split(/By car:/)[0]; // the on-foot part only
        assert.ok(/walk/.test(parts), `${chunk.id}: bus terminus time must say walk: ${sentence}`);
        assert.ok(!/drive|\bcar\b/i.test(parts.replace(/\bby car\b/gi, "")), `${chunk.id}: bus terminus must not be a drive: ${sentence}`);
      }
    }
  }

  // the location chunk states a mode for every time it gives
  const location = byId("location").text;
  assert.ok(/On foot: Adyar Bus Terminus is about a 5-minute walk/.test(location));
  assert.ok(/By car: Apollo Proton Cancer Centre is about a 5-minute drive and Chennai Airport about a 25-minute drive/.test(location));
});

test("policy questions find the specific rule", () => {
  const cases = {
    "Can I check in early?": "early-checkin",
    "Can I check out at 5 PM?": "late-checkout",
    "Can I bring a pet?": "pets",
    "Can my friend stay with me?": "visitors",
    "Can I smoke?": "smoking-alcohol",
    "Can I have a party?": "parties",
    "What is your cancellation policy?": "cancellation",
    "Will I get a refund?": "cancellation",
    "How much advance do I pay?": "advance",
    "What if I lose the key?": "key-damage",
  };
  for (const [question, id] of Object.entries(cases)) assert.equal(top(question), id, question);
});

test("simple Tanglish is understood", () => {
  assert.equal(normalizeTanglish("parking iruka?"), "parking is there?");
  assert.equal(normalizeTanglish("room venum oct 16 to 18"), "room need oct 16 to 18");
  assert.ok(normalizeTanglish("full apartment book panna mudiyuma?").includes("book do can"));
  assert.equal(top("parking iruka?"), "parking");
  assert.equal(top("iit madras how far?"), "iit");
  assert.equal(top("hospital near ah?"), "hospitals");
  assert.equal(top("early checkin possible?"), "early-checkin");
  assert.equal(top("full apartment book panna mudiyuma?"), "entire-flat");
  assert.equal(top("breakfast included?"), "meals");
  assert.equal(top("breakfast evlo?"), "meals");
});

test("guest situations are recognised from many wordings", () => {
  assert.ok(detectSituations("My mother has treatment at Apollo").includes("medical"));
  assert.ok(detectSituations("Need stay near Apollo").includes("medical"));
  assert.ok(detectSituations("My father has an appointment at Apollo").includes("medical"));
  assert.ok(detectSituations("We need accommodation for hospital treatment").includes("medical"));
  assert.ok(detectSituations("We are staying for 15 days").includes("long_stay"));
  assert.ok(detectSituations("Can I stay for one month?").includes("long_stay"));
  assert.ok(detectSituations("Need accommodation for 3 weeks").includes("long_stay"));
  assert.ok(!detectSituations("I need a room for 2 nights").includes("long_stay"));
  assert.ok(detectSituations("We are 6 people").includes("group"));
  assert.ok(detectSituations("Family of 5").includes("group"));
  assert.ok(detectSituations("We are coming from the US for 1 month").includes("nri"));
  assert.ok(detectSituations("We are coming for a wedding").includes("wedding"));
  assert.ok(detectSituations("My parents are visiting Chennai").includes("parents"));
  assert.deepEqual(detectSituations("Is breakfast included?"), []);
  // naming a hospital is a location question, not a medical stay
  assert.ok(!detectSituations("Is Apollo Proton nearby?").includes("medical"));
  assert.ok(!detectSituations("hospital near ?").includes("medical"));
  assert.ok(!detectSituations("How far is Apollo?").includes("medical"));
  assert.ok(detectSituations("Need stay near Apollo").includes("medical"));
});

test("guest counts", () => {
  assert.equal(detectGuestCount("We are 6 people"), 6);
  assert.equal(detectGuestCount("Family of 5"), 5);
  assert.equal(detectGuestCount("2 people"), 2);
  assert.equal(detectGuestCount("me and my wife"), 2);
  assert.equal(detectGuestCount("just me"), 1);
  assert.equal(detectGuestCount("for 2 nights"), null);
  assert.equal(isGuestReply("2"), true);
  assert.equal(isGuestReply("two people"), true);
  assert.equal(isGuestReply("22 Oct"), false);
  assert.equal(isGuestReply("What is the price?"), false);
  assert.equal(isRoomTypeReply("Queen"), true);
  assert.equal(isRoomTypeReply("master room please"), true);
  assert.equal(isRoomTypeReply("Is a Queen Room available?"), false);
  assert.equal(detectDurationDays("3 weeks"), 21);
  assert.equal(detectDurationDays("one month"), 30);
  assert.equal(detectDurationDays("2 nights"), 2);
});

test("complaints are recognised, questions are not", () => {
  assert.equal(detectComplaint("AC is not working"), "ac");
  assert.equal(detectComplaint("No hot water"), "hot_water");
  assert.equal(detectComplaint("Room is not cleaned"), "cleaning");
  assert.equal(detectComplaint("I lost my room key"), "key");
  assert.equal(detectComplaint("WiFi not working"), "wifi");
  assert.equal(detectComplaint("I forgot something in the room"), "forgot");
  assert.equal(detectComplaint("Do you have AC?"), null);
  assert.equal(detectComplaint("Is Wi-Fi available?"), null);
});

test("conversation context keeps what the guest already said in the SAME request", () => {
  const ctx1 = buildContext(["i need a room from october 16 to 18."], TODAY);
  assert.deepEqual(ctx1.stay, { checkIn: "2026-10-16", checkOut: "2026-10-18" });

  const ctx2 = buildContext(["i need a room from october 16 to 18.", "2 people"], TODAY);
  assert.deepEqual(ctx2.stay, { checkIn: "2026-10-16", checkOut: "2026-10-18" });
  assert.equal(ctx2.guestCount, 2);
  assert.equal(ctx2.occupancy, "double");
  assert.equal(ctx2.roomType, null);

  const ctx3 = buildContext(["i need a room from october 16 to 18.", "2 people", "queen"], TODAY);
  assert.deepEqual(ctx3.stay, { checkIn: "2026-10-16", checkOut: "2026-10-18" });
  assert.equal(ctx3.roomType, "queen");
  assert.equal(ctx3.occupancy, "double");

  const single = buildContext(["room from oct 16 to 18", "1"], TODAY);
  assert.equal(single.occupancy, "single");
});

test("a purpose given first is kept when dates arrive later", () => {
  const ctx = buildContext(["i need a room for my parents", "oct 16 to 18"], TODAY);
  assert.ok(ctx.situations.includes("parents"));
  assert.deepEqual(ctx.stay, { checkIn: "2026-10-16", checkOut: "2026-10-18" });
  assert.equal(ctx.aboutStay, true);
});

test("an older, separate question does not leak into a new request", () => {
  const ctx = buildContext(
    ["Is a Queen Room available for two people Oct 10 to 12?", "thanks", "I need a room from Oct 20"],
    TODAY
  );
  assert.equal(ctx.roomType, null);
  assert.equal(ctx.occupancy, null);
  assert.deepEqual(ctx.stay, { checkIn: "2026-10-20", needsCheckout: true });

  const unrelated = buildContext(["I need a room from Oct 20 to 22", "What day of the week is Oct 16?"], TODAY);
  assert.equal(unrelated.aboutStay, false, "an unrelated date question is not an availability request");
});

test("intent routing: unrelated questions are out of scope even with words like 'price'", () => {
  assert.equal(classify("what's the stock price of apple?").kind, "out_of_scope");
  assert.equal(classify("who won yesterday's cricket match?").kind, "out_of_scope");
  assert.equal(classify("what is the capital of france?").kind, "out_of_scope");
  assert.notEqual(classify("how much is the room price?").kind, "out_of_scope");
  assert.notEqual(classify("is there a pet policy?").kind, "out_of_scope");
});
