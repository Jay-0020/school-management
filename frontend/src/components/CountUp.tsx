import { useCountUp } from "../lib/useCountUp";

/** Renders a number that counts up on mount, optionally formatted. */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format ? format(v) : v.toLocaleString("en-IN")}</>;
}
