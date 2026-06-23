import { useRef, useState } from "react";
import { api } from "../api/client";
import { toast } from "../lib/toast";
import { photoUrl } from "../lib/photoUrl";
import { Avatar } from "./Avatar";

// Resize an image client-side (longest edge → `max`px) to a JPEG blob, so we
// never upload multi-MB phone photos — keeps stored files tiny.
async function resizeToBlob(file: File, max = 400): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Resize failed"))), "image/jpeg", 0.85)
  );
}

/** Avatar + upload/remove controls. Requires a saved record (needs its id). */
export function PhotoUploader({
  kind,
  id,
  name,
  hasPhoto,
  onChange,
}: {
  kind: "students" | "teachers";
  id: string;
  name: string;
  hasPhoto: boolean;
  onChange?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [present, setPresent] = useState(hasPhoto);
  const [bust, setBust] = useState(0); // cache-bust the <img> after a change
  const src = present ? `${photoUrl(kind, id)}?v=${bust}` : null;

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await resizeToBlob(file);
      const fd = new FormData();
      fd.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      await api.post(`/${kind}/${id}/photo`, fd);
      setPresent(true);
      setBust(Date.now());
      toast.success("Photo updated");
      onChange?.();
    } catch {
      toast.error("Couldn't upload the photo");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/${kind}/${id}/photo`);
      setPresent(false);
      setBust(Date.now());
      toast.success("Photo removed");
      onChange?.();
    } catch {
      toast.error("Couldn't remove the photo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="photo-uploader">
      <Avatar src={src} name={name} size={64} />
      <div className="photo-uploader-actions">
        <button
          type="button"
          className="inline-btn ghost"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Saving…" : present ? "Change photo" : "Upload photo"}
        </button>
        {present && !busy && (
          <button type="button" className="inline-btn ghost" onClick={remove}>
            Remove
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    </div>
  );
}
