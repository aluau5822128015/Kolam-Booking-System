import { Link } from "react-router-dom";
import logo from "../assets/kolam-logo/kolam-logo.png";
import "./FrontOffice.css";

// Shown for any address that is not a real page.
function NotFound() {
  return (
    <div className="fo-login-page">
      <div className="fo-login">
        <img src={logo} alt="Kolam Service Apartments" />
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist.</p>
        <p>
          <Link to="/">Back to the Kolam home page</Link>
        </p>
      </div>
    </div>
  );
}

export default NotFound;
