import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/kolam-logo/kolam-logo.png";
import { fetchBookings } from "../api/bookingsApi";
import { clearSession, getUsername } from "../api/auth";
import { PendingRequests, BookingRecords } from "./BookingRequests";
import RoomOccupancyCalendar from "./frontoffice/RoomOccupancyCalendar";
import BookingDetailsModal from "./frontoffice/BookingDetailsModal";
import RoomDetails from "./frontoffice/RoomDetails";
import { localTodayKey, summarize, formatDayKey } from "./frontoffice/calendarUtils";
import "./FrontOffice.css";
import "./frontoffice/Occupancy.css";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "rooms", label: "Room Details" },
  { id: "calendar", label: "Calendar / Occupancy" },
  { id: "requests", label: "Booking Requests" },
  { id: "bookings", label: "All Bookings" },
  { id: "reports", label: "Reports", soon: true },
  { id: "guests", label: "Guests", soon: true },
  { id: "settings", label: "Settings", soon: true },
];

function SummaryBar({ bookings }) {
  const s = summarize(bookings, localTodayKey());
  const items = [
    ["Available", s.available, "lg-available"],
    ["Occupied", s.occupied, "lg-occupied"],
    ["Pending", s.pending, "lg-pending"],
    ["Today's Check-ins", s.checkIns, "lg-info"],
    ["Today's Check-outs", s.checkOuts, "lg-info"],
  ];
  return (
    <div className="fo-summary">
      {items.map(([label, value, tone]) => (
        <div className="fo-stat" key={label}>
          <i className={`lg ${tone}`} />
          <b>{value}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function FrontOffice() {
  const navigate = useNavigate();
  const [view, setView] = useState("dashboard");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState(null);
  const [roomKey, setRoomKey] = useState("1A-R1");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setBookings(await fetchBookings());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const pending = bookings.filter((b) => b.status === "PENDING");

  const openRoom = (key) => {
    setRoomKey(key);
    setView("rooms");
  };

  // Shows loading / error states instead of a misleading all-available chart.
  const withData = (render) => {
    if (loading) return <div className="fo-empty">Loading booking requests...</div>;
    if (error) {
      return (
        <div className="fo-empty fo-empty-error">
          <p>Unable to load booking requests.</p>
          <button type="button" className="fo-btn fo-btn-primary" onClick={loadBookings}>Retry</button>
        </div>
      );
    }
    return render();
  };

  const calendar = () => (
    <RoomOccupancyCalendar bookings={bookings} onSelectBooking={setDetail} onSelectRoom={openRoom} />
  );

  const content = {
    dashboard: () =>
      withData(() => (
        <>
          <SummaryBar bookings={bookings} />
          {calendar()}
        </>
      )),
    calendar: () => withData(calendar),
    rooms: () =>
      withData(() => (
        <RoomDetails roomKey={roomKey} bookings={bookings} onSelectRoom={setRoomKey} onSelectBooking={setDetail} />
      )),
    requests: () =>
      withData(() => (
        <>
          <h2 className="fo-h2">Pending Booking Requests</h2>
          <PendingRequests bookings={pending} onChanged={loadBookings} />
        </>
      )),
    bookings: () =>
      withData(() => (
        <>
          <h2 className="fo-h2">All Bookings</h2>
          <BookingRecords bookings={bookings} />
        </>
      )),
  };

  const current = NAV.find((item) => item.id === view);

  return (
    <div className="fo-shell">
      <aside className="fo-sidebar">
        <div className="fo-brand">
          <img src={logo} alt="Kolam Service Apartments" />
          <span>Front Office</span>
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fo-nav${view === item.id ? " is-active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
              {item.id === "requests" && pending.length > 0 && <em className="fo-badge-count">{pending.length}</em>}
            </button>
          ))}
        </nav>
        <div className="fo-side-foot">
          <Link to="/">← Public website</Link>
          <button
            type="button"
            className="fo-nav"
            onClick={() => {
              clearSession();
              navigate("/front-office/login", { replace: true });
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="fo-content">
        <header className="fo-topbar">
          <h1>Front Office Dashboard</h1>
          <div className="fo-topinfo">
            <span>{formatDayKey(localTodayKey())}</span>
            <span>{getUsername()}</span>
          </div>
        </header>

        <main className="fo-body">
          {current.soon ? (
            <div className="fo-empty">{current.label} — coming soon</div>
          ) : (
            content[view]()
          )}
        </main>
      </div>

      {detail && <BookingDetailsModal booking={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default FrontOffice;
