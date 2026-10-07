import { useState } from "react";
import {
  ROOM_GROUPS,
  addDays,
  barsForRoom,
  bookingDayKey,
  buildDays,
  diffDays,
  formatDayKey,
  localTodayKey,
  bookingForRoomOnDay,
  roomKeysOfBooking,
} from "./calendarUtils";

const STEP_DAYS = 7;

function CalendarToolbar({ startKey, days, dayCount, onShift, onToday, onJump, onCount, search, onSearch }) {
  const first = days[0].key;
  const last = days[days.length - 1].key;
  return (
    <div className="occ-toolbar">
      <div className="occ-nav">
        <button type="button" className="fo-btn" onClick={() => onShift(-STEP_DAYS)} aria-label="Previous week">&lt;</button>
        <button type="button" className="fo-btn" onClick={() => onShift(STEP_DAYS)} aria-label="Next week">&gt;</button>
        <button type="button" className="fo-btn fo-btn-primary" onClick={onToday}>Today</button>
      </div>
      <strong className="occ-range">{formatDayKey(first)} – {formatDayKey(last)}</strong>
      <label className="occ-field">
        Go to
        <input type="date" value={startKey} onChange={(e) => e.target.value && onJump(e.target.value)} />
      </label>
      <label className="occ-field">
        View
        <select value={dayCount} onChange={(e) => onCount(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
        </select>
      </label>
      <input
        className="occ-search"
        type="search"
        placeholder="Search guest"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search guest"
      />
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="occ-legend">
      <span><i className="lg lg-available" /> Available</span>
      <span><i className="lg lg-occupied" /> Confirmed / Occupied</span>
      <span><i className="lg lg-pending" /> Pending (not blocking)</span>
      <span><i className="lg lg-info" /> Check-in / Check-out today</span>
    </div>
  );
}

// Background day cells shared by room rows and pending rows.
function DayCells({ days, todayKey, children }) {
  return days.map((day, i) => (
    <div
      key={day.key}
      className={`occ-cell${day.key === todayKey ? " is-today" : ""}${day.isWeekend ? " is-weekend" : ""}`}
      style={{ gridColumn: i + 2, gridRow: 1 }}
    >
      {children?.(day)}
    </div>
  ));
}

function BookingBar({ bar, todayKey, dimmed, pending, onSelect }) {
  const { booking, startCol, span, clippedLeft, clippedRight } = bar;
  const isCheckInToday = !clippedLeft && bookingDayKey(booking.checkIn) === todayKey;
  const label =
    booking.bookingType === "FLAT"
      ? `${booking.guestName} • Entire flat`
      : `${booking.guestName} • ${booking.guests} Guest${booking.guests === 1 ? "" : "s"}`;
  return (
    <button
      type="button"
      className={`occ-bar ${pending ? "occ-bar-pending" : "occ-bar-confirmed"}${dimmed ? " is-dimmed" : ""}${
        clippedLeft ? " clip-left" : ""
      }${clippedRight ? " clip-right" : ""}`}
      style={{ gridColumn: `${startCol + 2} / span ${span}`, gridRow: 1 }}
      title={`${booking.guestName} · ${formatDayKey(bookingDayKey(booking.checkIn))} → ${formatDayKey(
        bookingDayKey(booking.checkOut)
      )}`}
      onClick={() => onSelect(booking)}
    >
      {isCheckInToday && <span className="occ-chip">IN</span>}
      <span className="occ-bar-text">{label}</span>
    </button>
  );
}

function RoomTimelineRow({ room, bookings, days, todayKey, search, onSelectBooking, onSelectRoom }) {
  const bars = barsForRoom(room.roomKey, bookings, days[0].key, days.length);
  // Subtle check-out marker in today's column (the check-out day itself is free).
  const checkoutToday = bookings.some(
    (b) => roomKeysOfBooking(b).includes(room.roomKey) && bookingDayKey(b.checkOut) === todayKey
  );
  const isOccupiedToday = !!bookingForRoomOnDay(room.roomKey, bookings, todayKey);

  return (
    <div className="occ-row" role="row">
      <button
        type="button"
        className="occ-label"
        onClick={() => onSelectRoom(room.roomKey)}
        title={isOccupiedToday ? "Occupied today" : "Available today"}
      >
        {room.roomKey}
      </button>
      <DayCells days={days} todayKey={todayKey}>
        {(day) =>
          day.key === todayKey && checkoutToday ? <span className="occ-chip occ-chip-out">OUT</span> : null
        }
      </DayCells>
      {bars.map((bar) => (
        <BookingBar
          key={bar.booking._id}
          bar={bar}
          todayKey={todayKey}
          dimmed={!!search && !bar.booking.guestName.toLowerCase().includes(search.toLowerCase())}
          onSelect={onSelectBooking}
        />
      ))}
    </div>
  );
}

function RoomGroup({ group, ...rowProps }) {
  return (
    <div className="occ-group" role="rowgroup">
      <div className="occ-group-title">
        {group.title.toUpperCase()} ({group.rooms.length})
      </div>
      {group.rooms.map((room) => (
        <RoomTimelineRow key={room.roomKey} room={room} {...rowProps} />
      ))}
    </div>
  );
}

// Pending requests have no room yet, so they are listed apart and never block a room.
function PendingGroup({ bookings, days, todayKey, search, onSelectBooking }) {
  const pending = bookings
    .filter((b) => b.status === "PENDING")
    .map((booking) => {
      const inOffset = diffDays(days[0].key, bookingDayKey(booking.checkIn));
      const outOffset = diffDays(days[0].key, bookingDayKey(booking.checkOut));
      const startCol = Math.max(inOffset, 0);
      const endCol = Math.min(outOffset, days.length);
      return { booking, startCol, span: endCol - startCol, clippedLeft: inOffset < 0, clippedRight: outOffset > days.length };
    })
    .filter((bar) => bar.span > 0);

  return (
    <div className="occ-group" role="rowgroup">
      <div className="occ-group-title">PENDING REQUESTS — NOT ASSIGNED, NOT BLOCKING ({pending.length} in view)</div>
      {pending.length === 0 && <div className="occ-none">No pending requests in this period.</div>}
      {pending.map((bar) => (
        <div className="occ-row" role="row" key={bar.booking._id}>
          <div className="occ-label occ-label-static">Unassigned</div>
          <DayCells days={days} todayKey={todayKey} />
          <BookingBar
            bar={bar}
            todayKey={todayKey}
            pending
            dimmed={!!search && !bar.booking.guestName.toLowerCase().includes(search.toLowerCase())}
            onSelect={onSelectBooking}
          />
        </div>
      ))}
    </div>
  );
}

function RoomOccupancyCalendar({ bookings, onSelectBooking, onSelectRoom }) {
  const todayKey = localTodayKey();
  const [startKey, setStartKey] = useState(todayKey);
  const [dayCount, setDayCount] = useState(14);
  const [search, setSearch] = useState("");

  const days = buildDays(startKey, dayCount);
  const rowProps = { bookings, days, todayKey, search, onSelectBooking, onSelectRoom };

  return (
    <section className="occ">
      <CalendarToolbar
        startKey={startKey}
        days={days}
        dayCount={dayCount}
        onShift={(n) => setStartKey((key) => addDays(key, n))}
        onToday={() => setStartKey(todayKey)}
        onJump={setStartKey}
        onCount={setDayCount}
        search={search}
        onSearch={setSearch}
      />
      <StatusLegend />
      <div className="occ-scroll">
        <div className="occ-grid" style={{ "--days": dayCount }} role="table" aria-label="Room occupancy calendar">
          <div className="occ-row occ-head" role="row">
            <div className="occ-label occ-label-head">Room</div>
            {days.map((day, i) => (
              <div
                key={day.key}
                className={`occ-day${day.key === todayKey ? " is-today" : ""}${day.isWeekend ? " is-weekend" : ""}`}
                style={{ gridColumn: i + 2, gridRow: 1 }}
              >
                <span>{day.dow}</span>
                <b>{day.dayNum}</b>
                <small>{day.month}</small>
              </div>
            ))}
          </div>
          {ROOM_GROUPS.map((group) => (
            <RoomGroup key={group.roomId} group={group} {...rowProps} />
          ))}
          <PendingGroup {...rowProps} />
        </div>
      </div>
    </section>
  );
}

export default RoomOccupancyCalendar;
