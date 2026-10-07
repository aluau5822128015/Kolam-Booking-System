import { useState } from "react";
import { FLAT_IDS, ROOM_TYPES, makeRoomKey } from "../data/kolamConfig";
import { updateBooking } from "../api/bookingsApi";

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const roomTypeLabel = (roomType) =>
  ({ king: "Master Room", queen: "Queen Room", twin: "Twin Room", "no-preference": "No preference" }[roomType] ||
    roomType);

const bookingTypeLabel = (type) => (type === "FLAT" ? "Entire flat" : "Single room");

// Rooms staff may pick for the guest's requested room type.
const compatibleRooms = (roomType) =>
  Object.values(ROOM_TYPES).filter(
    (room) => roomType === "no-preference" || room.roomType === roomType
  );

// Friendly text for a failed PATCH. The backend decides availability.
const describeError = (error, booking) => {
  const status = error.response?.status;
  if (status === 409) {
    return booking.bookingType === "FLAT"
      ? "This flat is no longer available for these dates. Please select another flat."
      : "This room is no longer available for these dates. Please select another room.";
  }
  if (status === 400 && Array.isArray(error.response.data?.errors)) {
    return error.response.data.errors.join(" ");
  }
  if (status === 400 && error.response.data?.message) {
    return error.response.data.message;
  }
  return "Unable to update this booking. Please try again.";
};

function BookingDetails({ booking }) {
  return (
    <dl className="fo-details">
      <div><dt>Guest</dt><dd>{booking.guestName}</dd></div>
      <div><dt>Phone</dt><dd>{booking.phone}</dd></div>
      <div><dt>Check-in</dt><dd>{formatDate(booking.checkIn)}</dd></div>
      <div><dt>Check-out</dt><dd>{formatDate(booking.checkOut)}</dd></div>
      <div><dt>Guests</dt><dd>{booking.guests}</dd></div>
      <div><dt>Booking type</dt><dd>{bookingTypeLabel(booking.bookingType)}</dd></div>
      {booking.bookingType === "ROOM" && (
        <div><dt>Room type</dt><dd>{roomTypeLabel(booking.roomType)}</dd></div>
      )}
      {booking.specialRequest && (
        <div className="fo-wide"><dt>Special request</dt><dd>{booking.specialRequest}</dd></div>
      )}
    </dl>
  );
}

function ConfirmModal({ booking, onClose, onDone }) {
  const isFlat = booking.bookingType === "FLAT";
  const rooms = compatibleRooms(booking.roomType);
  const [flatId, setFlatId] = useState("");
  const [roomId, setRoomId] = useState(rooms.length === 1 ? rooms[0].roomId : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = flatId && (isFlat || roomId) && !saving;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateBooking(booking._id, {
        status: "CONFIRMED",
        assignedFlatId: flatId,
        assignedRoomKey: isFlat ? null : makeRoomKey(flatId, roomId),
      });
      await onDone();
    } catch (err) {
      setError(describeError(err, booking));
      setSaving(false);
    }
  };

  return (
    <div className="fo-overlay" role="dialog" aria-modal="true" aria-label="Confirm booking">
      <form className="fo-modal" onSubmit={submit}>
        <h3>Confirm booking</h3>
        <BookingDetails booking={booking} />

        <label>
          Flat
          <select value={flatId} onChange={(e) => setFlatId(e.target.value)} required>
            <option value="">Select flat</option>
            {FLAT_IDS.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>

        {isFlat ? (
          <p className="fo-note">The entire flat will be assigned.</p>
        ) : (
          <label>
            Room
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
              <option value="">Select room</option>
              {rooms.map((room) => (
                <option key={room.roomId} value={room.roomId}>
                  {room.roomId} - {room.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="fo-error" role="alert">{error}</p>}

        <div className="fo-actions">
          <button type="button" className="fo-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="fo-btn fo-btn-primary" disabled={!canSubmit}>
            {saving ? "Confirming..." : "Confirm booking"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RejectModal({ booking, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reject = async () => {
    setSaving(true);
    setError("");
    try {
      await updateBooking(booking._id, { status: "REJECTED" });
      await onDone();
    } catch (err) {
      setError(describeError(err, booking));
      setSaving(false);
    }
  };

  return (
    <div className="fo-overlay" role="dialog" aria-modal="true" aria-label="Reject booking">
      <div className="fo-modal">
        <h3>Reject booking</h3>
        <p>Are you sure you want to reject this booking request?</p>
        <BookingDetails booking={booking} />
        {error && <p className="fo-error" role="alert">{error}</p>}
        <div className="fo-actions">
          <button type="button" className="fo-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="fo-btn fo-btn-danger" onClick={reject} disabled={saving}>
            {saving ? "Rejecting..." : "Reject request"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pending requests with Confirm / Reject. `onChanged` reloads the booking list.
function PendingRequests({ bookings, onChanged }) {
  const [confirming, setConfirming] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const done = async () => {
    setConfirming(null);
    setRejecting(null);
    await onChanged();
  };

  if (bookings.length === 0) {
    return <div className="fo-empty">No pending booking requests</div>;
  }

  return (
    <>
      <div className="fo-requests">
        {bookings.map((booking) => (
          <article className="fo-request" key={booking._id}>
            <BookingDetails booking={booking} />
            <div className="fo-actions">
              <button type="button" className="fo-btn fo-btn-primary" onClick={() => setConfirming(booking)}>
                Confirm
              </button>
              <button type="button" className="fo-btn fo-btn-danger" onClick={() => setRejecting(booking)}>
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
      {confirming && <ConfirmModal booking={confirming} onClose={() => setConfirming(null)} onDone={done} />}
      {rejecting && <RejectModal booking={rejecting} onClose={() => setRejecting(null)} onDone={done} />}
    </>
  );
}

// Read-only table of all bookings with simple filters.
function BookingRecords({ bookings }) {
  const [status, setStatus] = useState("CONFIRMED");
  const [type, setType] = useState("ALL");

  const rows = bookings.filter(
    (b) => (status === "ALL" || b.status === status) && (type === "ALL" || b.bookingType === type)
  );

  return (
    <>
      <div className="fo-filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <label>
          Booking type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="ALL">All</option>
            <option value="ROOM">Room</option>
            <option value="FLAT">Flat</option>
          </select>
        </label>
      </div>
      {rows.length === 0 ? (
        <div className="fo-empty">No bookings match these filters</div>
      ) : (
        <div className="fo-table-wrap">
          <table className="fo-table">
            <thead>
              <tr>
                <th>Guest</th><th>Phone</th><th>Check-in</th><th>Check-out</th>
                <th>Guests</th><th>Type</th><th>Assigned</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b._id}>
                  <td>{b.guestName}</td>
                  <td>{b.phone}</td>
                  <td>{formatDate(b.checkIn)}</td>
                  <td>{formatDate(b.checkOut)}</td>
                  <td>{b.guests}</td>
                  <td>{bookingTypeLabel(b.bookingType)}</td>
                  <td>{b.assignedRoomKey || (b.assignedFlatId ? `Flat ${b.assignedFlatId}` : "—")}</td>
                  <td>{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export { PendingRequests, BookingRecords };
