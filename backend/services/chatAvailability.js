// Availability for the chatbot. It only READS dates / room type / guests from the guest's words
// (via conversationContext); the actual availability always comes from
// availabilityService -> bookingConflictService -> MongoDB. Nothing is calculated here.
//
// Used (1) as the deterministic reply when the AI is off or fails, and (2) to give the AI a
// "live availability" block so it formats real database results instead of guessing.

const { FACTS } = require("../config/propertyFacts");
const { FLAT_IDS } = require("../config/inventory");
const { checkAvailability, AvailabilityInputError } = require("./availabilityService");
const { wantsRoom } = require("./dateParser");

const ROOM_LABEL = { king: "Master Room", queen: "Queen Room", twin: "Twin Room" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_EXAMPLE = "16 Oct to 18 Oct";

const humanDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const nightsBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const inr = (amount) => `₹${amount.toLocaleString("en-IN")}`;

// Decides whether the current request is about availability. Returns:
//   { type: "check", stay }               a clear date range for a room/stay
//   { type: "ask_checkout", checkIn }     only one date so far
//   { type: "ask_dates" }                 a room request without dates
//   null                                  not an availability request
const detectAvailabilityRequest = (ctx, intent) => {
  // Other clear topics (cancellation, check-in times, breakfast, ...) keep their own answers.
  const compatible = intent.kind !== "topic" || ["availability", "booking", "prices"].includes(intent.topic);
  if (!compatible) return null;

  const asksAvailability = intent.kind === "topic" && intent.topic === "availability";
  const aboutStay = ctx.aboutStay || asksAvailability;

  if (ctx.stay && aboutStay) {
    if (ctx.stay.needsCheckout) return { type: "ask_checkout", checkIn: ctx.stay.checkIn };
    return { type: "check", stay: ctx.stay };
  }

  // A room request with no dates: ask for them. Booking/price questions keep their own answers.
  const plainRoomRequest = intent.kind !== "topic" || asksAvailability;
  const continuing = ctx.thread.length > 1; // "2 people" / "Queen" replying to our question
  if (!ctx.stay && plainRoomRequest && aboutStay && (wantsRoom(ctx.latest) || asksAvailability || continuing)) {
    return { type: "ask_dates" };
  }
  return null;
};

const askDatesReply = (ctx) =>
  ctx.situations.includes("parents") && !ctx.situations.includes("medical")
    ? `Sure. What dates will they be staying? (for example ${DATE_EXAMPLE})`
    : `Sure. What are your check-in and check-out dates? (for example ${DATE_EXAMPLE})`;

// Turns an availabilityService result into the counts the chatbot works with. `types` are the
// room types to show (all three, or the one the guest asked about); `allByType` always has all
// three, so claims about ANY type can be verified. Nothing is calculated here beyond counting.
const ALL_TYPES = ["king", "queen", "twin"];
const buildSnapshot = (data, { checkIn, checkOut }, types = ALL_TYPES) => {
  const nights = nightsBetween(checkIn, checkOut);
  const allByType = Object.fromEntries(ALL_TYPES.map((t) => [t, data.rooms.filter((room) => room.roomType === t).length]));
  return {
    checkIn,
    checkOut,
    nights,
    span: `${humanDate(checkIn)} to ${humanDate(checkOut)} (${nights} night${nights === 1 ? "" : "s"})`,
    total: FLAT_IDS.length,
    types,
    freeByType: Object.fromEntries(types.map((t) => [t, allByType[t]])),
    allByType,
    flatFree: data.flats.length,
  };
};

// Reads the real availability. Throws AvailabilityInputError for bad dates and any other
// error for real technical problems (database down).
const getAvailabilitySnapshot = async (request, ctx) => {
  const { checkIn, checkOut } = request.stay;
  const data = await checkAvailability({ checkIn, checkOut });
  return buildSnapshot(data, { checkIn, checkOut }, ctx.roomType ? [ctx.roomType] : ALL_TYPES);
};

const rateLines = (occupancy, showRooms, showFlat) => {
  const r = FACTS.rates;
  const line = (single, double, label) => {
    if (occupancy === "double") return `• ${label}: ${inr(double)} for double occupancy`;
    if (occupancy === "single") return `• ${label}: ${inr(single)} for single occupancy`;
    return `• ${label}: ${inr(single)} single occupancy / ${inr(double)} double occupancy`;
  };
  const lines = [];
  if (showRooms) lines.push(line(r.roomSingle, r.roomDouble, "Rooms"));
  if (showFlat) lines.push(line(r.flatSingle, r.flatDouble, "Entire flat"));
  return lines;
};

// Guest-count advice from trusted facts only (no invented capacities).
const guestAdvice = (guestCount) => {
  if (guestCount === 3) return `A third guest can be accommodated with an extra floor bed (${inr(FACTS.rates.extraBed)}).`;
  if (guestCount >= 4) {
    return `For ${guestCount} guests, I'd suggest taking more than one room in the same flat, or the entire flat so you stay together. Our front desk will confirm the best arrangement.`;
  }
  return null;
};

const formatAvailabilityReply = (snapshot, ctx, { prefix = "" } = {}) => {
  const { span, total, types, freeByType, flatFree } = snapshot;
  const anyRoomFree = Object.values(freeByType).some((n) => n > 0);
  const showFlat = !ctx.roomType || ctx.flatWanted;
  const noneFree = `Sorry, we have nothing free for ${span}. Please try different dates, send a booking request with 'Book a Room', or call our front desk on ${FACTS.phone}.`;

  if (!anyRoomFree && flatFree === 0) return `${prefix}${noneFree}`;

  const lines = types.map((t) => `• ${ROOM_LABEL[t]}: ${freeByType[t]} of ${total} free`);
  if (showFlat) lines.push(`• Entire flat: ${flatFree} of ${total} free`);

  const parts = [`${prefix}Here's what is free for ${span}:`, lines.join("\n")];
  if (ctx.roomType && !anyRoomFree) {
    parts.push(`No ${ROOM_LABEL[ctx.roomType]} is free for those dates${flatFree > 0 ? ", but an entire flat is" : ""}. You could try other dates or another room type.`);
  }
  parts.push("Rates:\n" + rateLines(ctx.occupancy, anyRoomFree || !showFlat, showFlat).join("\n"));
  if (ctx.doubleRoomMentioned && !ctx.occupancy) {
    parts.push("We don't have a room type called 'double'. Our rooms are Master, Queen and Twin, and each can be booked for single or double occupancy.");
  }
  const advice = guestAdvice(ctx.guestCount);
  if (advice) parts.push(advice);
  parts.push("This is a live availability check, not a booking. Tap 'Book a Room' to send a request and our front desk will confirm.");
  if (!ctx.occupancy && !ctx.guestCount) parts.push("How many guests will be staying? Then I can confirm the right rate.");
  return parts.join("\n\n");
};

// Deterministic reply text for an availability request. Throws only for real technical problems.
const buildAvailabilityReply = async (request, ctx, options = {}) => {
  if (request.type === "ask_checkout") {
    return `Thanks! Your check-in is ${humanDate(request.checkIn)}. Which date will you check out?`;
  }
  if (request.type === "ask_dates") return askDatesReply(ctx);

  try {
    return formatAvailabilityReply(await getAvailabilitySnapshot(request, ctx), ctx, options);
  } catch (error) {
    if (error instanceof AvailabilityInputError) {
      return `${error.message} Please tell me your check-in and check-out dates again, for example ${DATE_EXAMPLE}.`;
    }
    throw error;
  }
};

// The counts to show for a snapshot, worded for guests: "Master Room: 4 rooms available".
// Same numbers as the deterministic reply; nothing is calculated here.
const countLines = (snapshot, ctx) => {
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"} available`;
  const lines = snapshot.types.map((t) => ({
    key: t,
    expected: snapshot.freeByType[t],
    text: `${ROOM_LABEL[t]}: ${plural(snapshot.freeByType[t], "room")}`,
  }));
  if (!ctx.roomType || ctx.flatWanted) {
    lines.push({ key: "flat", expected: snapshot.flatFree, text: `Entire Flat: ${plural(snapshot.flatFree, "flat")}` });
  }
  return lines;
};

// Text block for the AI prompt: real database results it must use instead of guessing.
const describeSnapshotForPrompt = (snapshot, ctx) => {
  const lines = countLines(snapshot, ctx).map((line) => `- ${line.text}`);
  return [
    `Check-in ${snapshot.checkIn}, check-out ${snapshot.checkOut} (${snapshot.nights} night${snapshot.nights === 1 ? "" : "s"}), out of ${snapshot.total} rooms of each type and ${snapshot.total} flats.`,
    "You MUST state every one of these counts in your reply, using these exact numbers (one per line or in one clear sentence). Never leave one out and never change a number:",
    ...lines,
  ].join("\n");
};

module.exports = {
  detectAvailabilityRequest,
  getAvailabilitySnapshot,
  buildAvailabilityReply,
  formatAvailabilityReply,
  describeSnapshotForPrompt,
  buildSnapshot,
  countLines,
  ROOM_LABEL,
  askDatesReply,
};
