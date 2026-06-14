import type { ComponentType, SVGProps } from "react";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-ico">
        <Icon />
      </span>
      <span className="empty-title">{title}</span>
      {hint && <span className="empty-hint">{hint}</span>}
      {action}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="stat-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-card" key={i}>
          <div className="skeleton sk-line" style={{ width: "55%" }} />
          <div className="skeleton sk-line" style={{ width: "40%", height: 22 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="panel">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton sk-line" key={i} style={{ width: `${90 - i * 6}%` }} />
      ))}
    </div>
  );
}
