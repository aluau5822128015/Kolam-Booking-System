import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import logo from "../assets/kolam-logo/kolam-logo.png";
import { getToken, login } from "../api/auth";
import "./FrontOffice.css";

function StaffLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (getToken()) return <Navigate to="/front-office" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate("/front-office", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) setError("Invalid username or password.");
      else if (status === 429) setError("Too many failed attempts. Please try again later.");
      else setError("Unable to log in right now. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fo-login-page">
      <form className="fo-login" onSubmit={submit}>
        <img src={logo} alt="Kolam Service Apartments" />
        <h1>Staff Login</h1>
        <p>Front Office Dashboard</p>
        <p className="fo-hint">Use the Front Office email and password provided by management.</p>

        <label>
          Email
          <input
            type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="fo-error" role="alert">{error}</p>}

        <button type="submit" className="fo-btn fo-btn-primary" disabled={loading || !username || !password}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <Link to="/">← Public website</Link>
      </form>
    </div>
  );
}

export default StaffLogin;
