import propertyExterior from "../assets/gallery/property-exterior.jpg";
import bedroom from "../assets/gallery/bedroom.jpg";
import livingRoom from "../assets/gallery/living-room.jpg";
import kitchen from "../assets/gallery/kitchen.jpg";
import propertyView from "../assets/gallery/property-view.jpg";

function Gallery() {
  return (
    <section className="gallery-section gallery-animate" id="gallery">

      <div className="gallery-heading">
        <p>OUR GALLERY</p>
        <h2>Experience Kolam Gandhi</h2>
        <span>Take a glimpse of our comfortable spaces and facilities.</span>
      </div>

      <div className="gallery-grid">

        <div className="gallery-item">
          <img src={propertyExterior} alt="Property Exterior" />
        </div>

        <div className="gallery-item">
          <img src={bedroom} alt="Bedroom" />
        </div>

        <div className="gallery-item">
          <img src={livingRoom} alt="Living Room" />
        </div>

        <div className="gallery-item">
          <img src={kitchen} alt="Kitchen" />
        </div>

        <div className="gallery-item">
          <img src={propertyView} alt="Property View" />
        </div>

      </div>

    </section>
  );
}

export default Gallery;