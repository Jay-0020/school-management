import axios from "axios";
import { toast } from "../lib/toast";

const TOKEN_KEY = "smp_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, drop the token so the app falls back to the login screen.
// Surface unexpected failures (network / server) as a toast; leave 4xx
// (validation, conflicts) to the components that show inline messages.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) clearToken();
    else if (!error?.response) toast.error("Network error — check your connection");
    else if (status >= 500) toast.error("Something went wrong. Please try again.");
    return Promise.reject(error);
  }
);

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
