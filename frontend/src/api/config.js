// Single place that decides where the backend API lives.
// VITE_API_URL is baked in at build time (Vercel: Project Settings > Environment Variables).
// In development it falls back to the local backend; in production a missing value is a
// configuration error, never a silent call to "undefined/api/...".

const DEV_FALLBACK = "http://localhost:5000";

export const normalizeBase = (value) => String(value || "").trim().replace(/\/+$/, "");

export const resolveApiBase = (value, isDev) => {
  const base = normalizeBase(value);
  if (base) return base;
  if (isDev) return DEV_FALLBACK;
  throw new Error(
    "Configuration error: VITE_API_URL is not set. Set it to the backend URL and rebuild the frontend."
  );
};

// Returns the full URL for an API path such as "/api/bookings". Throws a clear
// configuration error in production when VITE_API_URL is missing.
export const apiUrl = (path) => {
  let base;
  try {
    base = resolveApiBase(import.meta.env.VITE_API_URL, import.meta.env.DEV);
  } catch (error) {
    console.error(error.message);
    throw error;
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};
