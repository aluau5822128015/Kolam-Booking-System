import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Rooms from "./components/Rooms";
import Amenities from "./components/Amenities";
import About from "./components/About";
import Gallery from "./components/Gallery";
import Location from "./components/Location";
import Contact from "./components/Contact";
import Booking from "./components/Booking";
import KolamChatbot from "./components/KolamChatbot";
import { Routes, Route } from "react-router-dom";
import FrontOffice from "./pages/FrontOffice";
import StaffLogin from "./pages/StaffLogin";
import RequireStaff from "./pages/RequireStaff";

function Home() {
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
      <KolamChatbot />
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/front-office/login" element={<StaffLogin />} />
      <Route
        path="/front-office"
        element={
          <RequireStaff>
            <FrontOffice />
          </RequireStaff>
        }
      />
    </Routes>
  );
}

export default App;
