import axios from "axios";

const AUTH_URL = `${import.meta.env.VITE_API_URL}/api/auth`;
const TOKEN_KEY = "kolamStaffToken";
const USER_KEY = "kolamStaffUser";

// sessionStorage: the session ends when the browser tab is closed.
const read = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const getToken = () => read(TOKEN_KEY);
export const getUsername = () => read(USER_KEY);

export const clearSession = () => {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable */
  }
};

export const login = async (username, password) => {
  const response = await axios.post(`${AUTH_URL}/login`, { username, password });
  try {
    sessionStorage.setItem(TOKEN_KEY, response.data.token);
    sessionStorage.setItem(USER_KEY, response.data.username);
  } catch {
    /* storage unavailable: login will not persist */
  }
  return response.data.username;
};

// Resolves if the stored token is still valid. Rejects with the axios error otherwise.
export const checkSession = async () => {
  const response = await axios.get(`${AUTH_URL}/me`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return response.data.username;
};
