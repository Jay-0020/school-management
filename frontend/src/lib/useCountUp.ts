import { useEffect, useRef, useState } from "react";

/** Animate 0 → target with an ease-out cubic. Uses rAF timestamps (no Date). */
export function useCountUp(target: number, ms = 700): number {
  const [val, setVal] = useState(target);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    startRef.current = null;
    const step = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return val;
}
