import { ROOMS, ROOM_TYPES } from "../../data/kolamConfig";
import { ROOM_GROUPS, bookingDayKey, bookingForRoomOnDay, formatDayKey, localTodayKey, upcomingForRoom } from "./calendarUtils";

// Details for one room, based on real confirmed bookings (today = staff's local date).
function RoomDetails({ roomKey, bookings, onSelectRoom, onSelectBooking }) {
  const todayKey = localTodayKey();
  const room = ROOMS.find((r) => r.roomKey === roomKey) || ROOMS[0];
  const current = bookingForRoomOnDay(room.roomKey, bookings, todayKey);
  const upcoming = upcomingForRoom(room.roomKey, bookings, todayKey).filter((b) => b !== current);

  return (
    <div className="rd">
      <aside className="rd-list">
        {ROOM_GROUPS.map((group) => (
          <div key={group.roomId}>
            <h4>{group.title}</h4>
            {group.rooms.map((r) => (
              <button
                key={r.roomKey}
                type="button"
                className={`rd-item${r.roomKey === room.roomKey ? " is-active" : ""}`}
                onClick={() => onSelectRoom(r.roomKey)}
              >
                {r.roomKey}
                <i className={`dot ${bookingForRoomOnDay(r.roomKey, bookings, todayKey) ? "dot-occ" : "dot-free"}`} />
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="rd-panel">
        <h2>Room {room.roomKey}</h2>
        <dl className="fo-details">
          <div><dt>Room</dt><dd>{room.roomKey}</dd></div>
          <div><dt>Type</dt><dd>{ROOM_TYPES[room.roomId].label}</dd></div>
          <div><dt>Flat</dt><dd>{room.flatId}</dd></div>
          <div><dt>Current status</dt><dd>{current ? "Occupied" : "Available"}</dd></div>
          {current && (
            <>
              <div><dt>Current guest</dt><dd>{current.guestName}</dd></div>
              <div>
                <dt>Current booking</dt>
                <dd>{current.bookingType === "FLAT" ? "Entire flat booking" : "Room booking"}</dd>
              </div>
              <div><dt>Check-in</dt><dd>{formatDayKey(bookingDayKey(current.checkIn))}</dd></div>
              <div><dt>Check-out</dt><dd>{formatDayKey(bookingDayKey(current.checkOut))}</dd></div>
            </>
          )}
        </dl>
        {current && (
          <button type="button" className="fo-btn" onClick={() => onSelectBooking(current)}>View booking</button>
        )}

        <h3>Upcoming confirmed bookings</h3>
        {upcoming.length === 0 ? (
          <p className="fo-note">None.</p>
        ) : (
          <ul className="rd-upcoming">
            {upcoming.map((b) => (
              <li key={b._id}>
                <button type="button" className="fo-link" onClick={() => onSelectBooking(b)}>
                  {b.guestName}
                </button>{" "}
                · {formatDayKey(bookingDayKey(b.checkIn))} → {formatDayKey(bookingDayKey(b.checkOut))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default RoomDetails;
