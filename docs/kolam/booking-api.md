# Booking API (Phase 2 backend foundation)

## Security
`GET /api/bookings` and `PATCH /api/bookings/:id` require a staff login token (see `staff-auth.md`). `POST /api/bookings` is public by design. `JWT_SECRET` must be set or protected routes return 503.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/bookings` | Public booking request. Always created `PENDING`, unassigned. Only these fields are accepted: guestName, phone, checkIn, checkOut, guests, roomType, bookingType, specialRequest (status/assignment sent by the public are ignored). `bookingType` defaults to `ROOM`. |
| GET | `/api/bookings` | (staff) List bookings, newest first. Optional `?status=` and `?bookingType=`. |
| PATCH | `/api/bookings/:id` | (staff) Front Office update. Allowed fields only: `status`, `assignedFlatId`, `assignedRoomKey`. |

## Lifecycle
`PENDING → CONFIRMED` or `PENDING → REJECTED`. CONFIRMED/REJECTED are final (further PATCH returns 409). Only CONFIRMED bookings occupy rooms.

## Assignment rules
- ROOM: confirm needs `assignedFlatId` + `assignedRoomKey` (e.g. `1A-R1`), the room must belong to the flat, and if the guest asked for king/queen/twin it must match (R1 king, R2 queen, R3 twin). `no-preference` matches any.
- FLAT: confirm needs `assignedFlatId`; `assignedRoomKey` must be empty.
- REJECT: no assignment allowed in the same request.

## Conflict rule
Dates are half-open `[checkIn, checkOut)`; a stay ending the day another starts does not conflict. A conflict is a CONFIRMED booking in the same flat with an overlapping range where either side is FLAT, or both are ROOM with the same room key. Different flats never conflict. Conflict returns `409`.

Code: `backend/services/bookingConflictService.js`, `backend/services/bookingRules.js`, `backend/config/inventory.js`.

## Legacy data
Status values were previously `Pending/Confirmed/Rejected`. They are now upper case. Existing records are still read correctly (output is upper-cased and filters/conflict queries are case-insensitive) and are rewritten upper-case when updated. No migration was run.

## Known limitations
- Two staff confirming conflicting bookings at the exact same moment could both pass the check (no DB transaction/unique constraint). Acceptable for a single front desk; revisit with transactions or a locking approach.
- Booking types, flats and rooms are duplicated in `backend/config/inventory.js` and `frontend/src/data/kolamConfig.js`.
- No cancellation/refund logic (policy ambiguities unresolved), no payments.

## Tests
`cd backend && npm test` — 29 integration tests against an in-memory MongoDB (`mongodb-memory-server`, first run downloads a mongod binary).
