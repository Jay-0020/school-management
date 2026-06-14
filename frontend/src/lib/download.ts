import { api } from "../api/client";
import { toast } from "./toast";

/** Fetch a PDF endpoint (with auth) and trigger a browser download. */
export async function downloadPdf(url: string, filename: string) {
  try {
    const res = await api.get(url, { responseType: "blob" });
    const blobUrl = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    toast.error("Could not generate the PDF");
  }
}
