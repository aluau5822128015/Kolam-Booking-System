import { useEffect, useId, useRef, useState } from "react";
import axios from "axios";
import logo from "../assets/kolam-logo/kolam-logo.png";
import { apiUrl } from "../api/config";
import "./KolamChatbot.css";

const CHAT_PATH = "/api/chat";
const FRONT_DESK_PHONE = "+91 87544 15469";
const FRONT_DESK_LINK = "tel:+918754415469";
const MAX_HISTORY = 10;
const WAVE_MS = 2600;

const QUICK_QUESTIONS = [
  { id: "availability", label: "Room availability" },
  { id: "prices", label: "Room prices" },
  { id: "checkin", label: "Check-in / Check-out" },
  { id: "breakfast", label: "Breakfast" },
  { id: "rules", label: "House rules" },
  { id: "cancellation", label: "Cancellation policy" },
  { id: "contact", label: "Contact us" },
];

const GREETING_TAGLINES = [
  "Your comfortable stay starts here ✨",
  "Let me make your stay a little easier 😊",
  "Need help with your room or booking? I'm here!",
  "Welcome to Kolam — how can I help today? 🌿",
];

const FAREWELLS = [
  "Have a lovely day! 🌿",
  "Hope to welcome you at Kolam soon! ✨",
  "Take care and have a wonderful stay! 😊",
  "See you soon at Kolam! 💚",
  "Have a beautiful day ahead! ✨",
  "It was lovely chatting with you! 🌸",
];

// Shown ONLY when the request genuinely failed (no connection, server error, missing route).
const TECHNICAL_ERROR = `Sorry, I couldn't reach the assistant just now. Please call our front desk on ${FRONT_DESK_PHONE} and we'll be happy to help.`;
const RATE_LIMITED = "You're sending messages a little fast 😊 Please wait a moment and try again.";

// Picks a random item that differs from the previous pick.
const pickDifferent = (list, lastIndexRef) => {
  let index;
  do {
    index = Math.floor(Math.random() * list.length);
  } while (index === lastIndexRef.current && list.length > 1);
  lastIndexRef.current = index;
  return list[index];
};

// Cute glossy assistant robot (white/silver body, dark glass face, glowing blue eyes).
// Idle: floats, breathes, blinks, glows. `waving` raises and waves the arm.
function RobotMascot({ waving = false, thinking = false, happy = false }) {
  const uid = useId().replace(/:/g, "");
  const id = (name) => `${name}-${uid}`;
  const className = `kc-robot-svg${waving ? " is-waving" : ""}${thinking ? " is-thinking" : ""}${happy ? " is-happy" : ""}`;

  return (
    <svg className={className} viewBox="0 0 100 112" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e8edf4" />
          <stop offset="1" stopColor="#c2cdda" />
        </linearGradient>
        <linearGradient id={id("head")} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id={id("side")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6f8fb" />
          <stop offset="1" stopColor="#b4c0cf" />
        </linearGradient>
        <radialGradient id={id("screen")} cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#27375f" />
          <stop offset="1" stopColor="#0a1022" />
        </radialGradient>
        <filter id={id("glow")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse className="kc-r-shadow" cx="50" cy="107" rx="21" ry="3.4" fill="rgba(0,0,0,0.2)" />

      <g className="kc-r-float">
        <g className="kc-r-body">
          <rect x="34" y="75" width="32" height="27" rx="14" fill={`url(#${id("body")})`} stroke="#c9d3df" strokeWidth="0.8" />
          <circle className="kc-r-glowy" cx="50" cy="88" r="3.2" fill="#6fdcff" filter={`url(#${id("glow")})`} />
          <path d="M40 96 Q50 100 60 96" fill="none" stroke="#c9d3df" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        <g transform="rotate(10 35 80)">
          <rect x="26" y="78" width="9" height="18" rx="4.5" fill={`url(#${id("side")})`} stroke="#b4c0cf" strokeWidth="0.7" />
        </g>
        <g className="kc-r-arm">
          <rect x="65" y="78" width="9" height="18" rx="4.5" fill={`url(#${id("side")})`} stroke="#b4c0cf" strokeWidth="0.7" />
          <circle cx="69.5" cy="95" r="4.4" fill="#ffffff" stroke="#b4c0cf" strokeWidth="0.8" />
        </g>

        <g className="kc-r-head">
          <rect x="5" y="34" width="12" height="23" rx="6" fill={`url(#${id("side")})`} stroke="#b4c0cf" strokeWidth="0.8" />
          <rect x="83" y="34" width="12" height="23" rx="6" fill={`url(#${id("side")})`} stroke="#b4c0cf" strokeWidth="0.8" />
          <rect className="kc-r-glowy" x="8.5" y="39" width="5" height="13" rx="2.5" fill="#6fdcff" filter={`url(#${id("glow")})`} />
          <rect className="kc-r-glowy" x="86.5" y="39" width="5" height="13" rx="2.5" fill="#6fdcff" filter={`url(#${id("glow")})`} />

          <rect x="43" y="4" width="14" height="10" rx="5" fill={`url(#${id("side")})`} stroke="#b4c0cf" strokeWidth="0.7" />
          <circle className="kc-r-glowy" cx="50" cy="9" r="2" fill="#6fdcff" filter={`url(#${id("glow")})`} />

          <rect x="11" y="12" width="78" height="64" rx="29" fill={`url(#${id("head")})`} stroke="#c3cfdc" strokeWidth="1" />
          <path d="M24 26 Q36 14 58 15 Q42 19 31 32 Z" fill="#ffffff" opacity="0.85" />

          <rect x="18" y="20" width="64" height="48" rx="23" fill={`url(#${id("screen")})`} stroke="#0a0f1f" strokeWidth="1" />
          <ellipse cx="38" cy="29" rx="15" ry="5" transform="rotate(-18 38 29)" fill="#ffffff" opacity="0.11" />

          <g className="kc-r-glowy" filter={`url(#${id("glow")})`}>
            <ellipse className="kc-r-eye" cx="37" cy="42" rx="6.2" ry="8" fill="#6fdcff" />
            <ellipse className="kc-r-eye" cx="63" cy="42" rx="6.2" ry="8" fill="#6fdcff" />
            <path d="M43 55.5 Q50 62 57 55.5" fill="none" stroke="#6fdcff" strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <ellipse className="kc-r-eye" cx="35.2" cy="39" rx="1.8" ry="2.3" fill="#ffffff" opacity="0.9" />
          <ellipse className="kc-r-eye" cx="61.2" cy="39" rx="1.8" ry="2.3" fill="#ffffff" opacity="0.9" />
          <circle cx="28" cy="53" r="3" fill="#ff9bb3" opacity="0.3" />
          <circle cx="72" cy="53" r="3" fill="#ff9bb3" opacity="0.3" />
        </g>
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
  const [waving, setWaving] = useState(false);
  const [happy, setHappy] = useState(false);
  const [tagline, setTagline] = useState(GREETING_TAGLINES[0]);
  const [flashId, setFlashId] = useState(null);

  const nextId = useRef(1);
  const lastFarewell = useRef(-1);
  const lastTagline = useRef(-1);
  const bubbleTimer = useRef(null);
  const waveTimer = useRef(null);
  const happyTimer = useRef(null);
  const flashTimer = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const robotRef = useRef(null);

  const showBubble = (text, ms) => {
    clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(""), ms);
  };

  const wave = () => {
    clearTimeout(waveTimer.current);
    setWaving(true);
    waveTimer.current = setTimeout(() => setWaving(false), WAVE_MS);
  };

  // Small greeting bubble + a friendly wave shortly after the page loads.
  useEffect(() => {
    const start = setTimeout(() => {
      showBubble("Hi! Need help?", 7000);
      wave();
    }, 2500);
    return () => {
      clearTimeout(start);
      clearTimeout(bubbleTimer.current);
      clearTimeout(waveTimer.current);
      clearTimeout(happyTimer.current);
      clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Opening: welcoming wave + a fresh greeting line (only changes while the chat is still empty).
  const openChat = () => {
    clearTimeout(bubbleTimer.current);
    setBubble("");
    if (messages.length === 0) setTagline(pickDifferent(GREETING_TAGLINES, lastTagline));
    setOpen(true);
    wave();
  };

  // Closing: a short warm goodbye and a friendly wave.
  const closeChat = () => {
    setOpen(false);
    showBubble(pickDifferent(FAREWELLS, lastFarewell), 6000);
    wave();
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

  const addMessage = (role, content, extra = {}) => ({ id: nextId.current++, role, content, ...extra });

  const send = async (text, quickQuestion) => {
    const content = text.trim();
    if (!content || loading) return;

    // Same quick question again: jump to the answer we already showed instead of repeating it.
    if (quickQuestion) {
      const existing = messages.find((message) => message.quick === quickQuestion);
      if (existing) {
        document.getElementById(`kc-msg-${existing.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        clearTimeout(flashTimer.current);
        setFlashId(existing.id);
        flashTimer.current = setTimeout(() => setFlashId(null), 1400);
        return;
      }
    }

    const history = [...messages, addMessage("user", content, quickQuestion ? { quick: quickQuestion } : {})];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post(apiUrl(CHAT_PATH), {
        messages: history.slice(-MAX_HISTORY).map(({ role, content: body }) => ({ role, content: body })),
        ...(quickQuestion ? { quickQuestion } : {}),
      });
      setMessages([...history, addMessage("assistant", response.data.reply, quickQuestion ? { quick: quickQuestion } : {})]);
      clearTimeout(happyTimer.current);
      setHappy(true);
      happyTimer.current = setTimeout(() => setHappy(false), 700);
    } catch (error) {
      // Only a real request failure lands here (offline, 404/5xx, timeout, rate limit).
      const reply = error.response?.status === 429 ? RATE_LIMITED : TECHNICAL_ERROR;
      setMessages([...history, addMessage("assistant", reply, { error: true })]);
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
            <div className="kc-hello">
              <div className="kc-hello-robot">
                <RobotMascot waving={waving} thinking={loading} happy={happy} />
              </div>
              <div className="kc-hello-text">
                <strong>Hi! 👋 Welcome to Kolam!</strong>
                <span>I'm Kolam Assistant, happy to help you with your stay 😊</span>
                <em>{tagline}</em>
              </div>
            </div>

            {messages.map((message) => (
              <div
                key={message.id}
                id={`kc-msg-${message.id}`}
                className={`kc-msg ${message.role === "user" ? "kc-user" : "kc-bot"}${message.error ? " kc-error" : ""}${
                  flashId === message.id ? " kc-flash" : ""
                }`}
              >
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
          onClick={open ? closeChat : openChat}
          aria-label={open ? "Close KOLAM Assistant chat" : "Open KOLAM Assistant chat"}
          aria-expanded={open}
        >
          <RobotMascot waving={waving} thinking={loading} happy={happy} />
        </button>
      </div>
    </div>
  );
}

export default KolamChatbot;
