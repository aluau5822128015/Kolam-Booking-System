// Approved Kolam Gandhi knowledge, split into small retrievable chunks.
//
// Sources and priority (see docs/kolam/chatbot-knowledge.md):
//   - type "official":    general property information from the official website
//                         https://kolamapartments.com/kolam-gandhi/ (captured 2026-10-07).
//   - type "operational": rules, rates and policies built from propertyFacts.js (the
//                         authoritative business data). They always win over anything else.
//   - type "process":     how to book / contact, consistent with the live website.
// Where the website and the operational rules disagree (lunch/dinner, check-in flexibility,
// WhatsApp number) the operational rules are used and the website claim is NOT repeated.
// `inPrompt: false` means the text duplicates a block that is already in the AI prompt.

const { FACTS, QUICK_ANSWERS } = require("../config/propertyFacts");

const inr = (amount) => `₹${amount.toLocaleString("en-IN")}`;
const r = FACTS.rates;

const TRAFFIC_NOTE = "Actual travel time can vary with traffic and route.";
const WALK_NOTE = "Walking time may vary a little.";

// The official website gives each place either a drive time or a walk time. The mode (drive vs
// walk) is part of the fact and must never be changed or dropped. Keep `text` explicit about it.
const place = (id, title, keywords, text, { walk = false } = {}) => ({
  id,
  title,
  type: "official",
  priority: 1, // a specific place beats the general "nearby" chunk when scores tie
  mode: walk ? "walk" : "drive",
  keywords,
  text: `${text} (as listed on our official website). ${walk ? WALK_NOTE : TRAFFIC_NOTE}`,
});

const KNOWLEDGE = [
  // ---------------- property overview ----------------
  {
    id: "overview",
    title: "About Kolam Gandhi",
    type: "official",
    keywords: ["about", "overview", "tell me about", "what is kolam", "kolam gandhi", "hotel", "is it a hotel", "apartment", "serviced apartment", "kind of place", "kind of accommodation", "type of property", "type of accommodation", "what kind", "property", "accommodation", "place to stay", "home away from home"],
    text: "Kolam Gandhi Serviced Apartments is your family's home away from home in Gandhi Nagar, Adyar, Chennai, designed for families and NRIs who want comfortable, extended stays. It is a serviced apartment rather than a conventional hotel: you book a private bedroom (or the entire flat) in a 3BHK apartment, and the living hall, dining area and kitchen are shared with the other guests of that flat. Breakfast is complimentary and our front desk is open 24 hours.",
  },
  {
    id: "how-stay-works",
    title: "How a stay works",
    type: "official",
    keywords: ["how does the stay work", "how it works", "how does it work", "shared", "share", "sharing", "other guests", "privacy", "private room", "shared apartment", "what is a serviced apartment"],
    text: "Each flat is a 3BHK with three private bedrooms (Master, Queen and Twin). If you book one bedroom, the living hall, dining area and kitchen are shared with guests staying in the other bedrooms of that flat. If you book the entire flat, the whole apartment is yours.",
  },
  {
    id: "rooms",
    title: "Rooms and flats",
    type: "official",
    keywords: ["rooms", "how many rooms", "number of rooms", "bedrooms", "bedroom", "room types", "types of rooms", "master", "queen", "twin", "bed", "beds", "bed type", "flats", "3bhk", "layout", "king"],
    text: "Kolam Gandhi has 6 flats (1A, 1B, 2A, 2B, 3A and 3B). Each is a 3BHK with three private bedrooms: a Master Room (king bed), a Queen Room and a Twin Room, so 18 rooms in total. You can book a single room or an entire flat.",
  },
  {
    id: "entire-flat",
    title: "Booking the entire flat",
    type: "operational",
    keywords: ["entire flat", "whole flat", "full flat", "full apartment", "whole apartment", "entire apartment", "complete flat", "all three rooms", "book whole", "whole house", "entire house", "flat booking"],
    text: `Yes, you can book the entire 3BHK flat: all three bedrooms plus the living hall, dining area and kitchen. Entire-flat rates are ${inr(r.flatSingle)} for single occupancy and ${inr(r.flatDouble)} for double occupancy, plus ${inr(r.extraPerson ?? r.extraBed)} for each extra person/floor bed. The booking form is mainly for single rooms, so please write "entire flat" in the special request or call our front desk on ${FACTS.phone}, and the team will confirm availability and your booking.`,
  },

  // ---------------- facilities ----------------
  {
    id: "amenities",
    title: "Facilities",
    type: "official",
    keywords: ["amenities", "amenity", "facilities", "facility", "what facilities", "what do you offer", "what is included", "features", "what do you provide"],
    text: "Facilities at Kolam Gandhi: spacious rooms, air conditioning, high-speed Wi-Fi, a fully equipped kitchen you can cook in, a shared living hall with TV and dining area, dedicated parking for guest vehicles, a washing machine for longer stays, complimentary breakfast, a gated property with 24/7 security and CCTV, and a 24-hour front desk. It is family-friendly and suits long stays.",
  },
  {
    id: "kitchen",
    title: "Kitchen and cooking",
    type: "official",
    keywords: ["kitchen", "cook", "cooking", "can i cook", "stove", "gas", "utensils", "prepare food", "self cooking"],
    text: "Yes, each flat has a fully equipped kitchen that guests can use for cooking. If you book a single room it is shared with the other guests of that flat. Please note the property is pure vegetarian, and the caretaker and kitchen break is 2:30 PM to 5:00 PM.",
  },
  {
    id: "wifi",
    title: "Wi-Fi",
    type: "official",
    keywords: ["wifi", "wi fi", "wi-fi", "internet", "network", "broadband", "speed", "work from home", "online"],
    text: "Yes, high-speed Wi-Fi is available throughout the property. Our team shares the Wi-Fi access details with guests.",
  },
  {
    id: "ac",
    title: "Air conditioning",
    type: "official",
    keywords: ["ac", "a/c", "air conditioning", "air conditioned", "air conditioner", "aircon", "cooling", "air-conditioned"],
    text: "Yes, all rooms are air-conditioned.",
  },
  {
    id: "parking",
    title: "Parking",
    type: "official",
    keywords: ["parking", "park", "car", "vehicle", "vehicles", "bike", "scooter", "two wheeler", "four wheeler", "garage", "drive"],
    text: "Yes, there is dedicated parking for guest vehicles. Parking is for staying guests, subject to property rules and availability.",
  },
  {
    id: "laundry",
    title: "Laundry",
    type: "official",
    keywords: ["laundry", "washing", "washing machine", "clothes", "wash", "detergent", "dry clean", "ironing"],
    text: `A washing machine is available, which is handy for longer stays. For single-room bookings, laundry is handled by the caretaker at ${inr(r.laundryPerLoad)} per load (up to 10 pieces). For entire-flat bookings, laundry is free to use. Please bring your own liquid detergent.`,
  },
  {
    id: "living-room",
    title: "Living hall, dining and TV",
    type: "official",
    keywords: ["living room", "living hall", "hall", "tv", "television", "common area", "common areas", "dining area", "dining", "sofa", "sit"],
    text: "Each flat has a shared living hall with a TV and a dining area as common spaces for its guests.",
  },
  {
    id: "security",
    title: "Security and safety",
    type: "official",
    keywords: ["security", "safe", "safety", "secure", "cctv", "gated", "guard", "women", "female", "solo traveller", "lock"],
    text: "The property is gated with 24/7 security and CCTV surveillance, and our front desk is staffed around the clock.",
  },
  {
    id: "meals",
    title: "Breakfast and meals",
    type: "operational",
    inPrompt: false,
    keywords: ["breakfast", "breakfast how much", "how much breakfast", "breakfast price", "meal", "meals", "food", "lunch", "dinner", "tea", "coffee", "eat", "restaurant", "vegetarian", "veg", "menu", "dining"],
    text: QUICK_ANSWERS.breakfast,
  },

  // ---------------- guest types and situations ----------------
  {
    id: "families",
    title: "Families and seniors",
    type: "official",
    keywords: ["family", "families", "kids", "children", "child", "baby", "senior", "seniors", "senior citizen", "elderly", "old age", "grandparents", "family friendly", "suitable for families", "good for families", "suitable for seniors"],
    text: "Yes. Kolam Gandhi is our family and NRI specialist, with spacious rooms and a welcoming, home-style environment for all ages, including seniors and young children.",
  },
  {
    id: "medical",
    title: "Medical stays",
    type: "official",
    weight: 0.9, // a question about one specific hospital should get the place answer
    keywords: ["medical", "medical stay", "treatment", "hospital stay", "hospital treatment", "patient", "patients", "apollo", "proton", "cancer", "surgery", "appointment", "doctor", "dialysis", "chemo", "therapy", "admitted", "check up", "checkup"],
    text: "Yes, Kolam Gandhi is suitable for medical stays: many of our guests are families accompanying patients at Apollo Proton Cancer Centre, which is about a 5-minute drive away (as listed on our official website). You get a family-friendly home setting with a kitchen you can cook in, Wi-Fi, air conditioning and a 24-hour front desk, and longer stays are welcome. Standard check-in is 12:00 PM and check-out 11:00 AM; if you need different timings for a hospital schedule, please ask our front desk.",
  },
  {
    id: "long-stay",
    title: "Long stays",
    type: "official",
    keywords: ["long stay", "long-stay", "extended stay", "extended", "weeks", "week", "month", "months", "monthly", "long term", "many days", "long period", "relocating"],
    text: "Kolam Gandhi suits longer stays well, with a kitchen you can cook in, a washing machine, Wi-Fi, air conditioning and a home-like setting. Our official website mentions special pricing for stays of 7 nights or more; the exact quote comes from our front desk, so please share your dates and call or WhatsApp them.",
  },
  {
    id: "discount",
    title: "Discounts and offers",
    type: "official",
    keywords: ["discount", "discounts", "offer", "offers", "cheaper", "concession", "deal", "negotiate", "special price", "special pricing", "lowest rate"],
    text: `Our official website mentions special pricing for stays of 7 nights or more. I can't quote a discount here, so please contact our front desk on ${FACTS.phone} with your dates and they will share the exact quote.`,
  },
  {
    id: "wedding-group",
    title: "Weddings and groups",
    type: "official",
    keywords: ["wedding", "marriage", "function", "reception", "group", "groups", "multiple rooms", "many rooms", "relatives", "big family", "batch", "together", "group booking"],
    text: "Yes, group bookings for wedding families can be arranged. Share your group size and dates with our front desk and they will help arrange rooms together, for example several rooms in the same flat or the entire flat. Please confirm group arrangements with the front desk.",
  },
  {
    id: "nri",
    title: "NRI and relocating guests",
    type: "official",
    keywords: ["nri", "abroad", "overseas", "usa", "united states", "uk", "canada", "australia", "returning", "relocating", "relocation", "coming from"],
    text: "Kolam Gandhi is a popular base for NRIs returning to Chennai and for families relocating to the city for a while: a home-like setup with a kitchen, Wi-Fi and air conditioning, suitable for a few days or several weeks.",
  },
  {
    id: "parents",
    title: "Parents and visiting family",
    type: "official",
    keywords: ["parents", "mother", "father", "in-laws", "in laws", "visiting children", "visiting me", "studying", "working in chennai"],
    text: "Yes, Kolam Gandhi suits parents visiting children who study or work in Chennai. It is a comfortable, welcoming home-style stay for all ages, including seniors.",
  },

  // ---------------- location and nearby ----------------
  {
    id: "location",
    title: "Location and address",
    type: "official",
    keywords: ["where", "where is", "where are you", "located", "location", "address", "area", "adyar", "gandhi nagar", "chennai", "directions", "how to reach", "how to get there", "map", "landmark", "situated"],
    text: `Kolam Gandhi is at ${FACTS.address}. It is in a well-connected part of Adyar. On foot: Adyar Bus Terminus is about a 5-minute walk. By car: Apollo Proton Cancer Centre is about a 5-minute drive and Chennai Airport about a 25-minute drive (as listed on our official website). ${TRAFFIC_NOTE}`,
  },
  {
    id: "nearby",
    title: "Nearby places",
    type: "official",
    keywords: ["nearby", "near", "around", "close", "close to", "places", "landmarks", "attractions", "surroundings", "what is near"],
    text: `Places near Kolam Gandhi (as listed on our official website). On foot: Adyar Bus Terminus is about a 5-minute walk (a walk, not a drive). By car: Apollo Proton Cancer Centre about a 5-minute drive, IIT Madras about 10 minutes, Besant Nagar Beach about 8 minutes, Ramachandra Convention Hall about 10 minutes, MRC Centre about 12 minutes, Phoenix Marketcity about 15 minutes, and Chennai Airport about 25 minutes. ${TRAFFIC_NOTE}`,
  },
  place("apollo", "Apollo Proton Cancer Centre", ["apollo", "proton", "cancer centre", "cancer center", "apollo hospital"], "Apollo Proton Cancer Centre is about a 5-minute drive from Kolam Gandhi"),
  place("iit", "IIT Madras", ["iit", "iit madras", "iitm", "campus"], "IIT Madras is about a 10-minute drive from Kolam Gandhi"),
  place("beach", "Besant Nagar Beach", ["besant nagar", "beach", "elliot", "sea", "seashore"], "Besant Nagar Beach is about an 8-minute drive from Kolam Gandhi"),
  place("ramachandra", "Ramachandra Convention Hall", ["ramachandra", "convention hall", "convention", "ramachandra hall"], "Ramachandra Convention Hall is about a 10-minute drive from Kolam Gandhi"),
  place("mrc", "MRC Centre", ["mrc", "mrc centre", "mrc center", "mrc nagar"], "MRC Centre is about a 12-minute drive from Kolam Gandhi"),
  place("phoenix", "Phoenix Marketcity", ["phoenix", "marketcity", "market city", "phoenix marketcity", "mall", "shopping"], "Phoenix Marketcity is about a 15-minute drive from Kolam Gandhi"),
  place("bus-terminus", "Adyar Bus Terminus", ["bus", "bus terminus", "bus stand", "bus stop", "adyar bus", "public transport", "walking distance"], "Adyar Bus Terminus is about a 5-minute walk from Kolam Gandhi (a walk, not a drive)", { walk: true }),
  place("airport", "Chennai Airport", ["airport", "flight", "flights", "chennai airport", "meenambakkam", "airport transfer", "pickup", "pick up"], "Chennai Airport is about a 25-minute drive from Kolam Gandhi"),
  {
    id: "hospitals",
    title: "Hospitals nearby",
    type: "official",
    priority: 1,
    keywords: ["hospital", "hospitals", "clinic", "medical centre", "medical center", "emergency", "doctor nearby"],
    text: `The hospital listed on our official website is Apollo Proton Cancer Centre, about a 5-minute drive from Kolam Gandhi. For any other hospital, travel time depends on the route and traffic, so please check a maps app or ask our front desk on ${FACTS.phone}.`,
  },
  {
    id: "nearby-unlisted",
    title: "Other places (distance not approved)",
    type: "official",
    priority: 1,
    keywords: ["railway", "railway station", "central", "egmore", "metro", "mrts", "train", "taxi", "kilometre", "kilometer", "km", "minutes from", "other places"],
    text: `I only have approved travel times for the places on our official website (Apollo Proton Cancer Centre, IIT Madras, Besant Nagar Beach, Ramachandra Convention Hall, MRC Centre, Phoenix Marketcity, Adyar Bus Terminus and Chennai Airport). For anything else, travel time depends on the route and traffic, so please check a maps app or ask our front desk on ${FACTS.phone}.`,
  },

  // ---------------- booking and contact ----------------
  {
    id: "how-to-book",
    title: "How to book",
    type: "process",
    keywords: ["how to book", "booking process", "reserve", "reservation", "direct booking", "book directly", "book a room", "booking form", "confirm booking"],
    text: `You can send a booking request with the 'Book a Room' button (the booking form on this page), or call or WhatsApp our front desk on ${FACTS.phone}. Our team checks availability and confirms; a request is not a confirmed booking until the front desk confirms it. A ${FACTS.advancePercent}% advance is required to confirm a booking.`,
  },
  {
    id: "contact",
    title: "Contact",
    type: "operational",
    inPrompt: false,
    keywords: ["contact", "phone", "call", "whatsapp", "number", "front desk", "email", "reach you", "talk to someone", "speak to"],
    text: QUICK_ANSWERS.contact,
  },

  // ---------------- operational rules (authoritative) ----------------
  { id: "pets", title: "Pets", type: "operational", keywords: ["pet", "pets", "dog", "dogs", "cat", "cats", "animal", "animals", "puppy"], text: "Sorry, pets are not allowed at Kolam Gandhi." },
  { id: "smoking-alcohol", title: "Smoking and alcohol", type: "operational", keywords: ["smoke", "smoking", "cigarette", "cigarettes", "alcohol", "drink", "drinks", "liquor", "beer", "wine", "vape"], text: "Smoking and alcohol are not allowed on the premises." },
  {
    id: "visitors",
    title: "Visitors and friends",
    type: "operational",
    keywords: ["friend", "friends", "visitor", "visitors", "outside guests", "relative visit", "someone stay", "extra person", "come and meet", "meet me", "stay with me", "guest staying"],
    text: `Visitors are welcome for up to 30 minutes and a maximum of 3 persons, and outside guests cannot dine inside. If someone will stay overnight, please inform our front desk; an extra person/floor bed is ${inr(r.extraBed)}.`,
  },
  { id: "parties", title: "Parties, events and photography", type: "operational", keywords: ["party", "parties", "celebration", "celebrations", "birthday", "event", "events", "gathering", "decoration", "decorations", "mehndi", "makeup", "photography", "photoshoot", "shoot", "photo"], text: "Parties, gatherings and celebrations or events are not allowed, and decorations, mehndi, makeup and photography are not permitted inside the premises." },
  { id: "quiet-hours", title: "Quiet hours", type: "operational", keywords: ["quiet", "noise", "music", "loud", "silent", "sleep", "noisy"], text: "Quiet hours are 10:00 PM to 7:00 AM." },
  { id: "vegetarian", title: "Vegetarian property", type: "operational", keywords: ["vegetarian", "non veg", "non-veg", "nonveg", "meat", "egg", "eggs", "chicken", "fish", "mutton"], text: "Kolam Gandhi is a pure vegetarian property." },
  { id: "check-times", title: "Check-in and check-out times", type: "operational", inPrompt: false, keywords: ["check in time", "check-in time", "check out time", "check-out time", "checkin time", "checkout time", "what time", "timing", "timings", "arrival time", "check in", "check out"], text: QUICK_ANSWERS.checkin },
  { id: "early-checkin", title: "Early check-in", type: "operational", keywords: ["early check in", "early check-in", "early checkin", "check in early", "arrive early", "early arrival", "morning arrival", "before noon", "9 am", "6 am", "early"], text: `Standard check-in is ${FACTS.checkIn}. Early check-in is available for ${inr(r.earlyCheckIn)} with breakfast, subject to availability, so please confirm with our front desk before you arrive.` },
  { id: "late-checkout", title: "Late check-out", type: "operational", keywords: ["late check out", "late check-out", "late checkout", "check out late", "checkout late", "leave late", "stay till evening", "extend checkout", "5 pm", "5pm", "evening checkout", "check out at"], text: `Check-out is ${FACTS.checkOut}. Late checkout is ${inr(r.lateCheckoutPer4Hours)} for every 4 hours until 7:00 PM, and after 7:00 PM a full-day charge applies. Early checkout is non-refundable.` },
  { id: "cancellation", title: "Cancellation policy", type: "operational", inPrompt: false, keywords: ["cancel", "cancellation", "cancelled", "refund", "money back", "change booking", "reschedule"], text: QUICK_ANSWERS.cancellation },
  { id: "advance", title: "Advance payment", type: "operational", keywords: ["advance", "payment", "pay", "deposit", "upi", "card", "how to pay", "token amount"], text: `A ${FACTS.advancePercent}% advance is required to confirm a booking. For stays of 6 to 30 days, a further 20% advance is due 30 days before check-in. Our front desk will guide you on how to pay.` },
  { id: "extra-bed", title: "Extra bed", type: "operational", keywords: ["extra bed", "extra person", "floor bed", "additional bed", "third person", "extra mattress", "extra guest"], text: `An extra floor bed (with bedsheet) is ${inr(r.extraBed)}.` },
  { id: "key-damage", title: "Lost key and damage charges", type: "operational", keywords: ["lost key", "key", "damage", "damages", "towel", "bedsheet", "comforter", "mattress", "linen"], text: `A lost room key is ${inr(r.lostKey)}. Damage charges: towel ${inr(r.damage.towel)}, double bedsheet ${inr(r.damage.doubleBedsheet)}, comforter ${inr(r.damage.comforter)}, mattress/linen ${inr(r.damage.mattressLinen)}.` },
  { id: "prices", title: "Room rates", type: "operational", inPrompt: false, keywords: ["price", "prices", "rate", "rates", "cost", "how much", "tariff", "charges", "per night", "rent", "pricing", "budget"], text: QUICK_ANSWERS.prices },
];

module.exports = { KNOWLEDGE };
