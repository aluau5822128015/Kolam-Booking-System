function Contact() {
  return (
    <section className="contact-section" id="contact">

      <div className="contact-heading">
        <p>CONTACT US</p>

        <h2>Plan Your Stay at Kolam Gandhi</h2>

        <span>
          Contact us directly for availability and booking assistance.
        </span>
      </div>

      <div className="contact-grid">

        <div className="contact-card">
          <div className="contact-icon">📞</div>
          <h3>Call Us</h3>
          <p>Speak with our team about your stay.</p>

          <a href="tel:+918754415469">
            +91 87544 15469
          </a>
        </div>

        <div className="contact-card">
          <div className="contact-icon">💬</div>
          <h3>WhatsApp</h3>
          <p>Message us for availability and booking.</p>

          <a
            href="https://wa.me/918754415469"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp Us
          </a>
        </div>

        <div className="contact-card">
          <div className="contact-icon">🕐</div>
          <h3>24-Hour Front Desk</h3>
          <p>
            Our front desk support is available around the clock.
          </p>
        </div>

        <div className="contact-card">
          <div className="contact-icon">📍</div>
          <h3>Our Address</h3>
          <p>
            Gandhi Nagar, Adyar, Chennai, Tamil Nadu
          </p>
        </div>

      </div>

    </section>
  );
}

export default Contact;