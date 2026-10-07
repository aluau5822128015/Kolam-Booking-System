import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getToken, clearSession, checkSession } from "../api/auth";
import { AUTH_EXPIRED_EVENT } from "../api/bookingsApi";

// Only renders its children for a logged-in staff member; otherwise goes to the login page.
// The real protection is on the backend: every Front Office API call needs a valid token.
function RequireStaff({ children }) {
  const [state, setState] = useState(getToken() ? "checking" : "out");

  useEffect(() => {
    const onExpired = () => setState("out");
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  useEffect(() => {
    if (state !== "checking") return;
    checkSession()
      .then(() => setState("in"))
      .catch((error) => {
        if (error.response?.status === 401) {
          clearSession();
          setState("out");
        } else {
          // Backend unreachable: let the dashboard show its own error and Retry.
          setState("in");
        }
      });
  }, [state]);

  if (state === "out") return <Navigate to="/front-office/login" replace />;
  if (state === "checking") return <div className="fo-login-page"><p>Checking session...</p></div>;
  return children;
}

export default RequireStaff;
