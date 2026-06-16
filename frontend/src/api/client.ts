import axios from "axios";
import { toast } from "../lib/toast";

// Auth is carried by an httpOnly session cookie (set by the server on login),
// so the browser sends it automatically — nothing is stored in JS/localStorage.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  withCredentials: true,
});

// On 401 (expired/absent session) bounce to login — except for the auth probes
// themselves, so we don't loop on the login screen or the initial /me check.
// Surface network/server failures as a toast; leave 4xx to the components.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    const isAuthProbe = url.includes("/auth/login") || url.includes("/auth/me");
    if (status === 401 && !isAuthProbe) {
      if (window.location.pathname !== "/login") window.location.href = "/login";
    } else if (!error?.response) {
      toast.error("Network error — check your connection");
    } else if (status >= 500) {
      toast.error("Something went wrong. Please try again.");
    }
    return Promise.reject(error);
  }
);
