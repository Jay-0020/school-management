import axios, { type InternalAxiosRequestConfig } from "axios";
import { toast } from "../lib/toast";

// Auth is carried by httpOnly cookies (a short-lived access token + a rotating
// refresh token), set by the server — nothing is stored in JS/localStorage.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  withCredentials: true,
});

// Single in-flight refresh shared across concurrent 401s.
let refreshing: Promise<unknown> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error?.response?.status as number | undefined;
    const config = error?.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const url = String(config?.url ?? "");
    const isAuthCall =
      url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/logout");

    // Access token expired → silently refresh once, then retry the request.
    if (status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        if (!refreshing) {
          refreshing = api.post("/auth/refresh").finally(() => {
            refreshing = null;
          });
        }
        await refreshing;
        return api(config);
      } catch {
        if (window.location.pathname !== "/login") window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    if (status === 401 && !isAuthCall) {
      // Refresh already tried and failed — session is gone.
      if (window.location.pathname !== "/login") window.location.href = "/login";
    } else if (!error?.response) {
      toast.error("Network error — check your connection");
    } else if (typeof status === "number" && status >= 500) {
      toast.error("Something went wrong. Please try again.");
    }
    return Promise.reject(error);
  }
);
