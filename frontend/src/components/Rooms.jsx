import kingRoom from "../assets/rooms/king-room.jpg";
import twinRoom from "../assets/rooms/twin-room.jpg";
import queenRoom from "../assets/rooms/queen-room.jpg";

function Rooms() {
  return (
    <section className="rooms-section rooms-animate" id="rooms">

      <div className="rooms-heading">
        <p>OUR ROOMS</p>

        <h2>Comfortable Stays at Kolam Gandhi</h2>

        <span>
          Choose a room that suits your stay in Adyar.
        </span>
      </div>

      <div className="rooms-grid">

        <div className="room-card">
          <div className="room-image">
            <img src={kingRoom} alt="Master Room" />
          </div>

          <div className="room-content">
            <h3>Master Room</h3>

            <p>
              Spacious and comfortable room suitable for
              couples, families and long stays.
            </p>

            <div className="room-info">
              <span>King Bed</span>
              <span>2 Guests</span>
            </div>

            <a href="#booking" className="room-button">
              Book Now
            </a>
          </div>
        </div>

        <div className="room-card">
          <div className="room-image">
            <img src={queenRoom} alt="Queen Room" />
          </div>

          <div className="room-content">
            <h3>Queen Room</h3>

            <p>
              A comfortable room designed for a relaxing
              and convenient stay.
            </p>

            <div className="room-info">
              <span>Queen Bed</span>
              <span>2 Guests</span>
            </div>

            <a href="#booking" className="room-button">
              Book Now
            </a>
          </div>
        </div>

        <div className="room-card">
          <div className="room-image">
            <img src={twinRoom} alt="Twin Room" />
          </div>

          <div className="room-content">
            <h3>Twin Room</h3>

            <p>
              Two separate beds, ideal for friends,
              colleagues and family members.
            </p>

            <div className="room-info">
              <span>2 Single Beds</span>
              <span>2 Guests</span>
            </div>

            <a href="#booking" className="room-button">
              Book Now
            </a>
          </div>
        </div>

      </div>

    </section>
  );
}

export default Rooms;
