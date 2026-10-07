# Front Office Dashboard — Requirements

Route: `/front-office`. Branded with the existing logo `frontend/src/assets/kolam-logo/kolam-logo.png`. Room-rack / occupancy-calendar concept; own design.

## Target workflow
Guest → Booking Request → Backend API → Database → Front Office Dashboard → Staff → Confirm / Reject / Assign Room.
A request is **not** a confirmed booking. No automatic room assignment.

## Goals
Room occupancy, reservations, available rooms, booking requests, check-ins, check-outs, maintenance/block status, room assignment.

## Phase status
| Item | Status |
|---|---|
| Route + dashboard shell, logo, summary cards | Implemented |
| Room inventory (6 flats / 18 rooms) + basic status view | Implemented (static) |
| Occupancy calendar | Placeholder only |
| Booking request list / confirm / reject | Not implemented — needs `GET`/`PATCH` API |
| Room assignment | Not implemented — needs schema fields |
| Staff authentication | Not implemented |

## Data model
- **Property**: `propertyId`, name, address
- **Flat**: `flatId`, `propertyId`, shared areas
- **Room**: `roomId` (R1..R3), `flatId`, `propertyId`, `roomType`, `bedType`, `status`; full id `1A-R1`
- **RoomType**: king / queen / twin
- **Rate**: per room type and occupancy; flat rates
- **BookingRequest**: guest details, dates, guests, room type preference, status Pending/Confirmed/Rejected (exists today as the `Booking` Mongoose model)
- **Booking**: confirmed request + assigned room(s) + payment (future)
- **Guest**: name, phone

Implemented (static, front-end) in `frontend/src/data/kolamConfig.js`.

## Known gaps in the existing backend
- `Booking` has no flat/room assignment field.
- `roomType` enum is `king|queen|twin|no-preference`; there is no entire-flat option.
- `guests` max is 3.
- No list/update endpoint exists (only `POST /api/bookings`).
- CORS is hard-coded to `http://localhost:5173`.
