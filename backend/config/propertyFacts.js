// Trusted Kolam facts used by the guest chatbot.
// Mirrors the supplied property information in docs/kolam/ and frontend/src/data/kolamConfig.js
// (rates, times, policy) and the Contact section of the public website.
// A test (tests/chat.test.js) checks the rates against the frontend config so they cannot drift.
// Do NOT put secrets (Wi-Fi password, keys) here.

const inr = (amount) => `₹${amount.toLocaleString("en-IN")}`;

const FACTS = {
  name: "Kolam Gandhi Serviced Apartments",
  address: "51/1, 2nd Main Road, Gandhi Nagar, Adyar, Chennai - 600020",
  phone: "+91 87544 15469",
  phoneLink: "tel:+918754415469",
  whatsappLink: "https://wa.me/918754415469",
  frontDesk: "24-hour front desk",
  checkIn: "12:00 PM",
  checkOut: "11:00 AM",
  rates: {
    roomSingle: 3885,
    roomDouble: 4200,
    flatSingle: 11655,
    flatDouble: 12600,
    extraBed: 560,
    earlyCheckIn: 1680,
    lateCheckoutPer4Hours: 900,
    lunch: 250,
    dinner: 250,
    lostKey: 300,
    laundryPerLoad: 105,
    damage: { towel: 500, doubleBedsheet: 750, comforter: 1300, mattressLinen: 1800 },
  },
  advancePercent: 30,
};

const CONTACT_LINE = `Please call our front desk on ${FACTS.phone} (or WhatsApp us) and the team will be happy to help.`;

// One-line fallback used whenever the bot does not have a trusted answer.
const UNKNOWN_REPLY = `I'm sorry, I don't have the correct information for that right now. ${CONTACT_LINE}`;

const r = FACTS.rates;

// Deterministic answers for the quick-question buttons (no AI needed, cannot hallucinate).
const QUICK_ANSWERS = {
  availability:
    "I can check live availability for you. Please tell me your check-in and check-out dates, and the room type if you have a preference (Master, Queen or Twin).\n\nFor example: \"Is a Queen Room free from 10 Oct to 12 Oct?\"",

  prices:
    `Our rates:\n` +
    `• Master, Queen or Twin Room: ${inr(r.roomSingle)} (single occupancy) / ${inr(r.roomDouble)} (double occupancy)\n` +
    `• Entire 3BHK flat: ${inr(r.flatSingle)} (single) / ${inr(r.flatDouble)} (double)\n` +
    `• Extra floor bed (with bedsheet): ${inr(r.extraBed)}\n` +
    `Breakfast is complimentary.`,

  checkin:
    `• Check-in: ${FACTS.checkIn}\n• Check-out: ${FACTS.checkOut}\n` +
    `• Early check-in: ${inr(r.earlyCheckIn)} with breakfast, subject to availability\n` +
    `• Late checkout: ${inr(r.lateCheckoutPer4Hours)} for every 4 hours until 7:00 PM; full-day charges apply after 7:00 PM\n` +
    `• Early checkout is non-refundable.`,

  breakfast:
    `Breakfast is complimentary, served in the dining area from 8:00 AM to 9:30 AM (no parcel service). ` +
    `The menu is a South Indian item with tea/coffee, and bread & jam is available as an option.\n` +
    `Morning tea/coffee: 6:45 AM – 9:00 AM. Evening tea/coffee: 5:30 PM – 6:00 PM.\n` +
    `Lunch and dinner are currently unavailable.`,

  rules:
    `House rules:\n` +
    `• Pure vegetarian property\n• No smoking, no alcohol, no pets\n• No parties, gatherings or celebrations\n` +
    `• No photography, decorations, mehndi or makeup\n• Quiet hours: 10:00 PM – 7:00 AM\n` +
    `• Visitors: maximum 30 minutes and 3 persons; no outside guests to dine inside\n` +
    `• Caretaker & kitchen break: 2:30 PM – 5:00 PM`,

  // Rules exactly as supplied. Overlapping/unclear cases are NOT interpreted.
  cancellation:
    `Bookings of 1–5 days:\n` +
    `• Full refund if cancelled at least 7 days before check-in\n` +
    `• 50% refund if cancelled within 3 days before check-in\n` +
    `• No refund if cancelled within 48 hours before check-in\n\n` +
    `Bookings of 6–30 days:\n` +
    `• ${FACTS.advancePercent}% advance at booking and an additional 20% advance 30 days before check-in\n` +
    `• Full refund if cancelled at least 30 days before check-in\n` +
    `• 50% refund if cancelled at least 15 days before check-in\n` +
    `• No refund if cancelled within 15 days before check-in\n\n` +
    `Early checkout is non-refundable. For the exact refund on your dates, please confirm with our front desk on ${FACTS.phone}.`,

  contact:
    `You can reach Kolam Gandhi at:\n• Phone / WhatsApp: ${FACTS.phone}\n• ${FACTS.frontDesk.charAt(0).toUpperCase() + FACTS.frontDesk.slice(1)}\n• Address: ${FACTS.address}`,
};

// Facts block placed in the AI system prompt.
const factsForPrompt = () =>
  [
    `Property: ${FACTS.name}, ${FACTS.address}. A 3BHK shared-apartment model: 6 flats (1A, 1B, 2A, 2B, 3A, 3B), each with 3 private bedrooms: R1 Master Room, R2 Queen Room, R3 Twin Room (18 rooms). Guests can book one room or an entire flat. Each flat shares a living hall, dining area and kitchen.`,
    `Contact: phone/WhatsApp ${FACTS.phone}; ${FACTS.frontDesk}.`,
    `Check-in ${FACTS.checkIn}; check-out ${FACTS.checkOut}.`,
    `Advance payment: ${FACTS.advancePercent}% to confirm a booking.`,
    ...["prices", "checkin", "breakfast", "rules", "cancellation"].map(
      (key) => `${key.toUpperCase()}:\n${QUICK_ANSWERS[key]}`
    ),
    `Other charges: lost room key ${inr(r.lostKey)}; laundry ${inr(r.laundryPerLoad)} per load (10 pieces) for single-room bookings, free for entire-flat bookings (guest brings own liquid detergent); damage charges: towel ${inr(r.damage.towel)}, double bedsheet ${inr(r.damage.doubleBedsheet)}, comforter ${inr(r.damage.comforter)}, mattress/linen ${inr(r.damage.mattressLinen)}. Parking is available for staying guests subject to property rules and availability. Lunch and dinner (${inr(r.lunch)} per meal) are currently unavailable.`,
  ].join("\n\n");

module.exports = { FACTS, CONTACT_LINE, UNKNOWN_REPLY, QUICK_ANSWERS, factsForPrompt };
