import { api } from "../api/client";
import { toast } from "./toast";

/** Fetch a file endpoint (with auth) and trigger a browser download. */
export async function downloadFile(url: string, filename: string) {
  const res = await api.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

/** Download a generated PDF, with a friendly error toast on failure. */
export async function downloadPdf(url: string, filename: string) {
  try {
    await downloadFile(url, filename);
  } catch {
    toast.error("Could not generate the PDF");
  }
}
