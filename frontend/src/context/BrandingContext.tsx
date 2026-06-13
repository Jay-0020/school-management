import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { SchoolSettings } from "../lib/types";

interface BrandingState {
  settings: SchoolSettings | null;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingState | undefined>(undefined);

function applyTheme(settings: SchoolSettings) {
  // Only override the CSS default when a colour is actually set.
  if (settings.primaryColor) {
    document.documentElement.style.setProperty("--primary", settings.primaryColor);
  }
  document.title = settings.name;
}

/**
 * Fetches this deployment's white-label settings and applies the primary
 * colour as a CSS variable so the whole app themes itself per school.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<SchoolSettings>("/school/settings");
      setSettings(res.data);
      applyTheme(res.data);
    } catch {
      // Backend not configured yet — fall back to defaults silently.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <BrandingContext.Provider value={{ settings, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingState {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
