import { ROOM_TYPES } from "../../data/kolamConfig";
import { bookingDayKey, formatDayKey } from "./calendarUtils";

const REQUESTED_TYPE = { king: "Master Room", queen: "Queen Room", twin: "Twin Room", "no-preference": "No preference" };

export const assignedLabel = (booking) => {
  if (booking.bookingType === "FLAT") {
    return booking.assignedFlatId ? `Entire flat ${booking.assignedFlatId}` : "Not assigned yet";
  }
  if (!booking.assignedRoomKey) return "Not assigned yet";
  const roomId = booking.assignedRoomKey.split("-")[1];
  return `${booking.assignedRoomKey} (${ROOM_TYPES[roomId]?.label || "Room"})`;
};

function BookingDetailsModal({ booking, onClose }) {
  const rows = [
    ["Guest name", booking.guestName],
    ["Phone", booking.phone],
    ["Check-in", formatDayKey(bookingDayKey(booking.checkIn))],
    ["Check-out", formatDayKey(bookingDayKey(booking.checkOut))],
    ["Guests", booking.guests],
    ["Booking type", booking.bookingType === "FLAT" ? "Entire flat" : "Single room"],
    ...(booking.bookingType === "ROOM" ? [["Requested room type", REQUESTED_TYPE[booking.roomType] || booking.roomType]] : []),
    ["Assigned", assignedLabel(booking)],
    ["Status", booking.status],
    ["Special request", booking.specialRequest || "—"],
  ];

  return (
    <div className="fo-overlay" role="dialog" aria-modal="true" aria-label="Booking details" onClick={onClose}>
      <div className="fo-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Booking details</h3>
        <dl className="fo-details">
          {rows.map(([label, value]) => (
            <div key={label} className={label === "Special request" ? "fo-wide" : undefined}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="fo-actions">
          <button type="button" className="fo-btn fo-btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default BookingDetailsModal;
