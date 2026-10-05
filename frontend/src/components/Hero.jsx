import heroBg from "../assets/backgrounds/background.jpg";

function Hero() {
  return (
    <section
      className="hero hero-animate"
      id="home"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <div className="hero-content">
        <p className="hero-small-title">WELCOME TO KOLAM</p>

        <h1>Kolam Gandhi</h1>

        <h2>Serviced Apartments in Adyar</h2>

        <p className="hero-description">
          Comfortable and spacious stays for families, NRIs and business travellers.
        </p>

        <div className="hero-buttons">
          <a href="#rooms" className="hero-btn primary-btn">
            Explore Rooms
          </a>

          <a href="#location" className="hero-btn secondary-btn">
            View Location
          </a>
        </div>
      </div>
    </section>
  );
}

export default Hero;