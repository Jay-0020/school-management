import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { SchoolSettings } from "../lib/types";

const BrandingContext = createContext<SchoolSettings | null>(null);

/**
 * Fetches this deployment's white-label settings and applies the primary
 * colour as a CSS variable so the whole app themes itself per school.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    api
      .get<SchoolSettings>("/school/settings")
      .then((res) => {
        setSettings(res.data);
        document.documentElement.style.setProperty(
          "--primary",
          res.data.primaryColor
        );
        document.title = res.data.name;
      })
      .catch(() => {
        // Backend not configured yet — fall back to defaults silently.
      });
  }, []);

  return (
    <BrandingContext.Provider value={settings}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): SchoolSettings | null {
  return useContext(BrandingContext);
}
