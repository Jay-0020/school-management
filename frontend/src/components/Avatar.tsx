import { useEffect, useState } from "react";

// Round avatar: shows the photo when `src` is given, otherwise a brand-gradient
// initials circle (reusing the existing .avatar style). Falls back to initials
// if the image fails to load.
export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };

  if (!src || failed) {
    return (
      <span className="avatar" style={style} aria-label={name}>
        {initials}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      src={src}
      alt={name}
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
