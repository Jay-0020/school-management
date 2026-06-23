import { api } from "../api/client";

// Same-origin URL for a person's photo. <img> requests carry the auth cookie
// automatically, and the endpoint is tenant-scoped, so this is safe to use as src.
export function photoUrl(kind: "students" | "teachers", id: string): string {
  return `${api.defaults.baseURL ?? "/api"}/${kind}/${id}/photo`;
}
