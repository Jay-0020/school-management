import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { SkeletonRows } from "../components/EmptyState";

interface Options {
  sections: { id: string; label: string }[];
  subjects: { id: string; name: string }[];
  teachers: { id: string; name: string; employeeNo: string }[];
}
interface Assignment {
  id: string;
  subjectId: string;
  subject: string;
  teacherId: string;
  teacher: string;
}

export function AssignmentsPage() {
  const qc = useQueryClient();
  const [sectionId, setSectionId] = useState("");

  const { data: options } = useQuery({
    queryKey: ["assign-options"],
    queryFn: async () => (await api.get<Options>("/assignments/options")).data,
  });

  useEffect(() => {
    if (!sectionId && options?.sections.length) setSectionId(options.sections[0].id);
  }, [options, sectionId]);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["assignments", sectionId],
    queryFn: async () =>
      (await api.get<{ items: Assignment[] }>("/assignments", { params: { sectionId } })).data.items,
    enabled: !!sectionId,
  });

  const bySubject = new Map((assignments ?? []).map((a) => [a.subjectId, a]));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["assignments", sectionId] });

  const assign = useMutation({
    mutationFn: (v: { subjectId: string; teacherId: string }) =>
      api.post("/assignments", { sectionId, ...v }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/assignments/${id}`),
    onSuccess: invalidate,
  });

  function onChange(subjectId: string, teacherId: string) {
    if (teacherId) assign.mutate({ subjectId, teacherId });
    else {
      const ex = bySubject.get(subjectId);
      if (ex) remove.mutate(ex.id);
    }
  }

  return (
    <AppShell title="Teaching Assignments">
      <div className="page-head">
        <h2>Teaching Assignments</h2>
        <div className="controls">
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {options?.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="muted">
        Assign a teacher to each subject for the selected class-section. This defines a student's
        teachers (used for ratings and feedback).
      </p>

      {isLoading && <SkeletonRows />}
      {options && options.subjects.length === 0 && (
        <p className="muted">No subjects defined yet — add subjects first.</p>
      )}

      {options && options.subjects.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Teacher</th>
            </tr>
          </thead>
          <tbody>
            {options.subjects.map((sub) => {
              const ex = bySubject.get(sub.id);
              return (
                <tr key={sub.id}>
                  <td>{sub.name}</td>
                  <td>
                    <select
                      value={ex?.teacherId ?? ""}
                      onChange={(e) => onChange(sub.id, e.target.value)}
                    >
                      <option value="">— Unassigned —</option>
                      {options.teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} · {t.employeeNo}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  );
}
