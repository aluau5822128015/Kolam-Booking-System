# Booking Policy

Source of truth in code: `frontend/src/data/kolamConfig.js` (`POLICY`).

## Check-in / Check-out
- Check-in: 12:00 PM
- Check-out: 11:00 AM
- Early check-in: ₹1,680 with breakfast, subject to availability.
- Late checkout: ₹900 for every 4 hours until 7:00 PM. After 7:00 PM, full-day charges apply.
- Early checkout: non-refundable.

## Advance payment
30% required to confirm booking.

## Cancellation — bookings of 1–5 days (as supplied)
- Full refund: cancelled at least 7 days before check-in.
- 50% refund: cancelled within 3 days before check-in.
- No refund: cancelled within 48 hours before check-in.
- Early checkout: no refund.

## Bookings of 6–30 days (as supplied)
- 30% advance payment at booking.
- Additional 20% advance payment required 30 days before check-in.
- Full refund: cancelled at least 30 days before check-in.
- 50% refund: cancelled at least 15 days before check-in.
- No refund: cancelled within 15 days before check-in.

## Ambiguities — NOT resolved. BUSINESS CLARIFICATION REQUIRED
1. **1–5 day bookings:** "within 3 days" (50%) and "within 48 hours" (none) overlap, since 48 hours is inside 3 days.
2. **1–5 day bookings:** nothing is stated for cancellation between 3 and 7 days before check-in.
3. **6–30 day bookings:** "at least 15 days" (50%) overlaps "at least 30 days" (full); precedence is not stated.
4. **6–30 day bookings:** the "additional 20% 30 days before check-in" cannot be met for bookings made less than 30 days ahead; behaviour is undefined.
5. Bookings longer than 30 days: no policy supplied.
6. Not stated whether refund percentages apply to the advance paid or the total booking value.

The code stores these rules as text only and implements no automatic refund calculation.

## Booking limits — BUSINESS CLARIFICATION REQUIRED
The booking form currently accepts: an identical request submitted twice (two PENDING requests), any future check-in date, and any stay length. No maximum stay, booking horizon or duplicate policy has been supplied, so none is enforced. Technical limits that do exist: name 2-100 characters, phone format, special request up to 1000 characters, 1-3 guests, check-in not in the past, check-in before check-out. The chatbot availability check is limited to 30 nights per query.
