import { useEffect, useRef, useState } from "react";
import axios from "axios";
import logo from "../assets/kolam-logo/kolam-logo.png";
import "./KolamChatbot.css";

const CHAT_URL = `${import.meta.env.VITE_API_URL}/api/chat`;
const FRONT_DESK_PHONE = "+91 87544 15469";
const FRONT_DESK_LINK = "tel:+918754415469";
const MAX_HISTORY = 10;

const QUICK_QUESTIONS = [
  { id: "availability", label: "Room availability" },
  { id: "prices", label: "Room prices" },
  { id: "checkin", label: "Check-in / Check-out" },
  { id: "breakfast", label: "Breakfast" },
  { id: "rules", label: "House rules" },
  { id: "cancellation", label: "Cancellation policy" },
  { id: "contact", label: "Contact us" },
];

const FAREWELLS = [
  "Thank you for visiting Kolam. Have a lovely day! 🌿",
  "It was lovely helping you. We hope to welcome you to Kolam soon! 💚",
  "Have a wonderful day! We look forward to welcoming you. ✨",
  "Thank you for choosing Kolam. Take care and have a beautiful day! 🌸",
  "We hope to see you at Kolam soon. Until then, have a great day! 😊",
  "Have a pleasant day! Your Kolam team is always happy to help. 💚",
  "Safe travels, and we hope to welcome you soon! 🌿",
];

const WELCOME =
  "Hi! Welcome to Kolam 🌿\nI'm here to help you with rooms, prices, availability, stay information and more.";

const NETWORK_ERROR = `Sorry, I couldn't reach the assistant just now. Please call our front desk on ${FRONT_DESK_PHONE} and we'll be happy to help.`;

// Friendly original robot mascot (not the Kolam logo). The right arm waves gently.
function RobotMascot() {
  return (
    <svg className="kc-robot-svg" viewBox="0 0 64 72" aria-hidden="true" focusable="false">
      <line x1="32" y1="6" x2="32" y2="14" stroke="#7a1f1f" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3.2" fill="#b8860b" />
      <path d="M35 6 q5 -5 9 -1 q-4 5 -9 1z" fill="#4f9d5d" />
      <rect x="14" y="14" width="36" height="28" rx="12" fill="#ffffff" stroke="#b8860b" strokeWidth="2.5" />
      <rect x="19" y="19" width="26" height="18" rx="8" fill="#fdf3d9" />
      <circle cx="26" cy="27" r="2.6" fill="#7a1f1f" />
      <circle cx="38" cy="27" r="2.6" fill="#7a1f1f" />
      <circle cx="22.5" cy="32" r="2" fill="#f2a98f" opacity="0.7" />
      <circle cx="41.5" cy="32" r="2" fill="#f2a98f" opacity="0.7" />
      <path d="M27 31.5 Q32 36 37 31.5" fill="none" stroke="#7a1f1f" strokeWidth="2" strokeLinecap="round" />
      <rect x="18" y="45" width="28" height="20" rx="8" fill="#b8860b" />
      <circle cx="32" cy="55" r="4.5" fill="#ffffff" />
      <circle cx="32" cy="55" r="1.8" fill="#7a1f1f" />
      <line x1="18" y1="50" x2="11" y2="60" stroke="#b8860b" strokeWidth="5" strokeLinecap="round" />
      <g className="kc-arm">
        <line x1="46" y1="50" x2="54" y2="40" stroke="#b8860b" strokeWidth="5" strokeLinecap="round" />
        <circle cx="55" cy="38" r="3.6" fill="#ffffff" stroke="#b8860b" strokeWidth="1.8" />
      </g>
    </svg>
  );
}

function KolamChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bubble, setBubble] = useState("");
  const lastFarewell = useRef(-1);
  const bubbleTimer = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const robotRef = useRef(null);

  const showBubble = (text, ms) => {
    clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(""), ms);
  };

  // Small greeting bubble shortly after the page loads.
  useEffect(() => {
    const start = setTimeout(() => showBubble("Hi! Need help?", 7000), 2500);
    return () => {
      clearTimeout(start);
      clearTimeout(bubbleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const openChat = () => {
    clearTimeout(bubbleTimer.current);
    setBubble("");
    setOpen(true);
  };

  // Closing with the X (or Escape) shows a rotating friendly goodbye from the robot.
  const closeChat = () => {
    setOpen(false);
    let index;
    do {
      index = Math.floor(Math.random() * FAREWELLS.length);
    } while (index === lastFarewell.current && FAREWELLS.length > 1);
    lastFarewell.current = index;
    showBubble(FAREWELLS[index], 6000);
    robotRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeChat();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text, quickQuestion) => {
    const content = text.trim();
    if (!content || loading) return;

    const history = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post(CHAT_URL, {
        messages: history.slice(-MAX_HISTORY).map(({ role, content: body }) => ({ role, content: body })),
        ...(quickQuestion ? { quickQuestion } : {}),
      });
      setMessages([...history, { role: "assistant", content: response.data.reply }]);
    } catch {
      setMessages([...history, { role: "assistant", content: NETWORK_ERROR }]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    send(input);
  };

  // Does not create a booking: takes the guest to the existing booking form.
  const goToBooking = () => {
    setOpen(false);
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="kc-root">
      {open && (
        <section className="kc-panel" role="dialog" aria-label="KOLAM Assistant">
          <header className="kc-header">
            <img src={logo} alt="Kolam" className="kc-logo" />
            <div className="kc-titles">
              <strong>KOLAM Assistant</strong>
              <span>How can we help you today?</span>
            </div>
            <button type="button" className="kc-close" onClick={closeChat} aria-label="Close chat">
              ×
            </button>
          </header>
          <div className="kc-pattern" aria-hidden="true" />

          <div className="kc-body" ref={bodyRef} aria-live="polite">
            <div className="kc-msg kc-bot">{WELCOME}</div>

            {messages.map((message, index) => (
              <div key={index} className={`kc-msg ${message.role === "user" ? "kc-user" : "kc-bot"}`}>
                {message.content}
              </div>
            ))}

            {loading && <div className="kc-msg kc-bot kc-thinking">Kolam Assistant is thinking...</div>}

            {!loading && (
              <div className="kc-quick" role="group" aria-label="Quick questions">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question.id}
                    type="button"
                    className="kc-chip"
                    onClick={() => send(question.label, question.id)}
                  >
                    {question.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="kc-actions">
            <button type="button" className="kc-action kc-action-main" onClick={goToBooking}>
              Book a Room
            </button>
            <a className="kc-action" href={FRONT_DESK_LINK}>
              Call Front Desk
            </a>
          </div>

          <form className="kc-form" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type your question..."
              maxLength={500}
              aria-label="Type your question"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send message">
              Send
            </button>
          </form>
        </section>
      )}

      {!open && (
        <div className="kc-launcher">
          {bubble && (
            <div className="kc-bubble" role="status">
              {bubble}
            </div>
          )}
          <button
            type="button"
            ref={robotRef}
            className="kc-robot"
            onClick={openChat}
            aria-label="Open KOLAM Assistant chat"
          >
            <RobotMascot />
          </button>
        </div>
      )}
    </div>
  );
}

export default KolamChatbot;
