import { useState } from "react";
import axios from "axios";
import { apiUrl } from "../api/config";

function Booking() {
  // Earliest selectable date (the server also rejects past check-in dates).
  const today = new Date().toLocaleDateString("en-CA");

  const [formData, setFormData] = useState({
    guestName: "",
    phone: "",
    checkIn: "",
    checkOut: "",
    guests: "",
    roomType: "",
    specialRequest: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);

      await axios.post(
        apiUrl("/api/bookings"),
        {
          guestName: formData.guestName,
          phone: formData.phone,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          guests: Number(formData.guests),
          roomType: formData.roomType,
          specialRequest: formData.specialRequest,
        }
      );

      alert(
        "Your booking request has been received. Our front desk team will check availability and contact you."
      );

      setFormData({
        guestName: "",
        phone: "",
        checkIn: "",
        checkOut: "",
        guests: "",
        roomType: "",
        specialRequest: "",
      });
    } catch (error) {
      console.error("Booking submission failed:", error.response?.status || error.message);

      alert(
        "Sorry, we could not submit your booking request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="booking">

      <h2>Book Your Stay</h2>

      <p>
        Send us your booking request. Our front desk team will check
        availability and contact you for confirmation.
      </p>

      <form onSubmit={handleSubmit}>

        <label>Guest Name</label>
        <input
          type="text"
          name="guestName"
          placeholder="Enter your name"
          value={formData.guestName}
          onChange={handleChange}
          minLength={2}
          maxLength={100}
          required
        />

        <label>Phone Number</label>
        <input
          type="tel"
          name="phone"
          placeholder="Enter your phone number"
          value={formData.phone}
          onChange={handleChange}
          pattern="\+?[0-9][0-9\s\-]{6,19}"
          title="Enter a valid phone number (7-20 digits, optional + at the start)"
          maxLength={20}
          required
        />

        <label>Check-in Date</label>
        <input
          type="date"
          name="checkIn"
          value={formData.checkIn}
          onChange={handleChange}
          min={today}
          required
        />

        <label>Check-out Date</label>
        <input
          type="date"
          name="checkOut"
          value={formData.checkOut}
          onChange={handleChange}
          min={formData.checkIn || today}
          required
        />

        <label>Number of Guests</label>
        <select
          name="guests"
          value={formData.guests}
          onChange={handleChange}
          required
        >
          <option value="">Select number of guests</option>
          <option value="1">1 Guest</option>
          <option value="2">2 Guests</option>
          <option value="3">3 Guests</option>
        </select>

        <label>Preferred Room Type</label>
        <select
          name="roomType"
          value={formData.roomType}
          onChange={handleChange}
          required
        >
          <option value="">Select room type</option>
          <option value="king">Master Room</option>
          <option value="queen">Queen Room</option>
          <option value="twin">Twin Room</option>
          <option value="no-preference">No Preference</option>
        </select>

        <label>Message / Special Request</label>
        <textarea
          name="specialRequest"
          placeholder="Tell us any special request or requirement..."
          rows="5"
          maxLength={1000}
          value={formData.specialRequest}
          onChange={handleChange}
        ></textarea>

        <p>
          Maximum 3 guests are allowed per booking.
        </p>

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Booking Request"}
        </button>

      </form>

    </section>
  );
}

export default Booking;