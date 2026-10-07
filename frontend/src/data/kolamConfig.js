// Single source of truth for Kolam Gandhi property, inventory, rates and policy.
// Values are as supplied by the business. Do not store secrets (Wi-Fi, keys) here.

export const PROPERTY = {
  propertyId: "KOLAM_GANDHI",
  name: "Kolam Gandhi Serviced Apartments",
  address: "51/1, 2nd Main Road, Gandhi Nagar, Adyar, Chennai - 600020",
  website: "https://kolamapartments.com/kolam-gandhi/",
  checkIn: "12:00 PM",
  checkOut: "11:00 AM",
};

export const SHARED_AREAS = ["Living Hall", "Dining Area", "Kitchen"];

export const ROOM_TYPES = {
  R1: { roomId: "R1", roomType: "king", bedType: "King", label: "Master Room" },
  R2: { roomId: "R2", roomType: "queen", bedType: "Queen", label: "Queen Room" },
  R3: { roomId: "R3", roomType: "twin", bedType: "Twin", label: "Twin Room" },
};

export const FLAT_IDS = ["1A", "1B", "2A", "2B", "3A", "3B"];

export const ROOM_STATUSES = ["available", "occupied", "reserved", "blocked"];

// Amounts in INR.
export const RATES = {
  room: { single: 3885, double: 4200 }, // identical for King, Queen and Twin
  flat: { single: 11655, double: 12600 },
  extraPerson: 560, // extra floor bed / person, with bedsheet
  earlyCheckIn: 1680, // with breakfast, subject to availability
  lateCheckOutPer4Hours: 900, // until 7:00 PM; full-day charge after 7:00 PM
  meal: { lunch: 250, dinner: 250 },
  lostKey: 300,
  laundryPerLoad: 105, // single room booking, per load / 10 pieces
  damage: { towel: 500, doubleBedsheet: 750, comforter: 1300, mattressLinen: 1800 },
};

// Explicit availability flags so the UI never implies unavailable services are on offer.
export const SERVICES = {
  breakfast: { available: true, note: "Complimentary, 8:00 AM - 9:30 AM, dining area, no parcel" },
  lunch: { available: false, note: "Temporarily unavailable (cylinder issues)" },
  dinner: { available: false, note: "Temporarily unavailable (cylinder issues)" },
};

// Rules recorded as supplied. Overlaps/gaps are documented in docs/kolam/booking-policy.md
// and intentionally NOT resolved in code.
export const POLICY = {
  advancePercent: 30,
  shortStay: {
    days: "1-5",
    rules: [
      "Full refund: cancelled at least 7 days before check-in",
      "50% refund: cancelled within 3 days before check-in",
      "No refund: cancelled within 48 hours before check-in",
      "Early checkout: no refund",
    ],
  },
  longStay: {
    days: "6-30",
    rules: [
      "30% advance at booking; additional 20% advance 30 days before check-in",
      "Full refund: cancelled at least 30 days before check-in",
      "50% refund: cancelled at least 15 days before check-in",
      "No refund: cancelled within 15 days before check-in",
    ],
  },
};

export const makeRoomKey = (flatId, roomId) => `${flatId}-${roomId}`;

export const FLATS = FLAT_IDS.map((flatId) => ({
  propertyId: PROPERTY.propertyId,
  flatId,
  floor: Number(flatId[0]),
  sharedAreas: SHARED_AREAS,
}));

// Static inventory: 18 rooms. Status is "available" until booking data is wired in.
export const ROOMS = FLAT_IDS.flatMap((flatId) =>
  Object.values(ROOM_TYPES).map((t) => ({
    propertyId: PROPERTY.propertyId,
    flatId,
    roomId: t.roomId,
    roomKey: makeRoomKey(flatId, t.roomId),
    roomType: t.roomType,
    bedType: t.bedType,
    status: "available",
  }))
);
