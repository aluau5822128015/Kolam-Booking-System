function Location() {
  return (
    <section className="location-section" id="location">
      <div className="location-heading">
        <p>OUR LOCATION</p>
        <h2>Conveniently Located in Adyar</h2>
        <span>
          Stay connected to Chennai with easy access to nearby
          business, shopping and travel destinations.
        </span>
      </div>

      <div className="location-content">
        <div className="location-info">
          <h3>Kolam Gandhi Serviced Apartments</h3>
          <p>51, 2nd Main Road, Gandhi Nagar, Adyar, Chennai - 600020</p>
          <p>
            A convenient location for business travellers,
            families and long stays.
          </p>
          <a href="https://maps.app.goo.gl/qqQ76wauoJmCX2eU8" target="_blank" rel="noreferrer" className="location-button">
            View on Google Maps
          </a>
        </div>

        <div className="map-placeholder">
          <iframe
            title="Kolam Gandhi Location"
            src="https://maps.google.com/maps?q=51%202nd%20Main%20Road%2C%20Gandhi%20Nagar%2C%20Adyar%2C%20Chennai%2C%20600020&t=&z=15&ie=UTF8&iwloc=&output=embed"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </div>
    </section>
  );
}

export default Location;