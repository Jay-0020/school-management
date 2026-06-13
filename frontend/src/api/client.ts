import axios from "axios";

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
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) clearToken();
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
