import axios from "axios";
import { getToken, clearSession } from "./auth";
import { apiUrl } from "./config";

const bookingsUrl = () => apiUrl("/api/bookings");

export const AUTH_EXPIRED_EVENT = "kolam:auth-expired";

// Front Office requests carry the staff token; a 401 ends the session.
const http = axios.create();

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export const fetchBookings = async () => {
  const response = await http.get(bookingsUrl());
  return response.data.bookings;
};

// body is exactly what the backend PATCH /api/bookings/:id expects.
export const updateBooking = async (id, body) => {
  const response = await http.patch(`${bookingsUrl()}/${id}`, body);
  return response.data.booking;
};
