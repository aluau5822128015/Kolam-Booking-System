import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Rooms from "./components/Rooms";
import Amenities from "./components/Amenities";
import About from "./components/About";
import Gallery from "./components/Gallery";
import Location from "./components/Location";
import Contact from "./components/Contact";
import Booking from "./components/Booking";

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <Rooms />
      <Amenities />
      <About />
      <Gallery />
      <Location />
      <Booking/>
      <Contact />
    </>
  );
}

export default App;
