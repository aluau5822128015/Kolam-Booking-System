import logo from "../assets/kolam-logo/kolam-logo.png";

function Navbar() {
  return (
    <nav className="navbar">

      <img
        src={logo}
        alt="Kolam Service Apartments"
        className="kolam-logo"
      />

      <div className="navbar-links">
        <a href="#home">Home</a>
        <a href="#about">About</a>
        <a href="#rooms">Rooms</a>
        <a href="#amenities">Amenities</a>
        <a href="#gallery">Gallery</a>
        <a href="#location">Location</a>
        <a href="#booking">Book Now</a>
      </div>

    </nav>
  );
}

export default Navbar;