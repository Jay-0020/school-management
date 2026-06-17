import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { EmptyState, SkeletonRows } from "../components/EmptyState";
import { IconTeacher } from "../components/icons";

interface Rateable {
  teacherId: string;
  name: string;
  employeeNo: string;
  subjects: string[];
  myStars: number | null;
  myComment: string | null;
}
interface FeedbackItem {
  id: string;
  student: string;
  type: "FEEDBACK" | "COMMENDATION";
  category: string;
  message: string;
  author: string;
  createdAt: string;
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`star ${n <= value ? "on" : ""}`}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function FeedbackPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["rateable"],
    queryFn: async () => (await api.get<{ items: Rateable[] }>("/ratings/rateable")).data.items,
  });

  const { data: feedback } = useQuery({
    queryKey: ["my-feedback"],
    queryFn: async () => (await api.get<{ items: FeedbackItem[] }>("/feedback/mine")).data.items,
  });

  return (
    <AppShell title="Feedback">
      <h2>Rate Your Teachers</h2>
      <p className="muted">Your ratings are anonymous — teachers only ever see their average.</p>

      {isLoading && <SkeletonRows />}
      {data && data.length === 0 && (
        <EmptyState
          icon={IconTeacher}
          title="No teachers yet"
          hint="Your teachers appear here once they're assigned to your class."
        />
      )}

      <div className="rate-list">
        {data?.map((t) => (
          <RateCard
            key={t.teacherId}
            t={t}
            onSaved={() => qc.invalidateQueries({ queryKey: ["rateable"] })}
          />
        ))}
      </div>

      <h2 style={{ marginTop: 28 }}>Feedback &amp; commendations</h2>
      {feedback && feedback.length === 0 && (
        <p className="muted">No feedback from teachers yet.</p>
      )}
      <div className="rate-list">
        {feedback?.map((f) => (
          <div className="rate-card" key={f.id}>
            <div className="rate-head">
              <div>
                {f.type === "COMMENDATION" ? (
                  <span className="badge-ok">👏 Commendation</span>
                ) : (
                  <span className="badge">Feedback</span>
                )}
                {f.student && <span className="muted"> · {f.student}</span>}
              </div>
              <span className="muted inline">{new Date(f.createdAt).toLocaleDateString()}</span>
            </div>
            <p style={{ margin: "4px 0" }}>{f.message}</p>
            <span className="muted inline">
              {f.category} · by {f.author}
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function RateCard({ t, onSaved }: { t: Rateable; onSaved: () => void }) {
  const [stars, setStars] = useState(t.myStars ?? 0);
  const [comment, setComment] = useState(t.myComment ?? "");
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => api.post("/ratings", { teacherId: t.teacherId, stars, comment: comment || null }),
    onSuccess: () => {
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="rate-card">
      <div className="rate-head">
        <div>
          <strong>{t.name}</strong>
          {t.subjects.length > 0 && <span className="muted"> · {t.subjects.join(", ")}</span>}
        </div>
        <Stars value={stars} onChange={setStars} />
      </div>
      <textarea
        rows={2}
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="form-actions">
        {saved && <span className="ok inline">Saved ✓</span>}
        {!saved && t.myStars != null && (
          <span className="muted inline">Current: {t.myStars}★</span>
        )}
        <button
          className="inline-btn"
          disabled={!stars || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : t.myStars != null ? "Update rating" : "Save rating"}
        </button>
      </div>
    </div>
  );
}
