import { useState } from "react";
import axios from "axios";

function Booking() {
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

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/bookings`,
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

      console.log("Booking created:", response.data);

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
      console.error("Booking submission failed:", error);

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
          required
        />

        <label>Phone Number</label>
        <input
          type="tel"
          name="phone"
          placeholder="Enter your phone number"
          value={formData.phone}
          onChange={handleChange}
          required
        />

        <label>Check-in Date</label>
        <input
          type="date"
          name="checkIn"
          value={formData.checkIn}
          onChange={handleChange}
          required
        />

        <label>Check-out Date</label>
        <input
          type="date"
          name="checkOut"
          value={formData.checkOut}
          onChange={handleChange}
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
          <option value="king">King Room</option>
          <option value="queen">Queen Room</option>
          <option value="twin">Twin Room</option>
          <option value="no-preference">No Preference</option>
        </select>

        <label>Message / Special Request</label>
        <textarea
          name="specialRequest"
          placeholder="Tell us any special request or requirement..."
          rows="5"
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