import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { FinanceOverview as Fin } from "../lib/types";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Dean / Admin financial overview — fees pending, staff payments pending,
 *  salary paid to date, total expenditure + a category breakdown. */
export function FinanceOverview() {
  const { data } = useQuery({
    queryKey: ["finance-overview"],
    queryFn: async () => (await api.get<Fin>("/dashboard/finance")).data,
  });
  if (!data) return null;

  const cards = [
    { key: "fees", label: "Student fees pending", value: inr(data.feesPending) },
    { key: "staffpay", label: "Staff payments pending", value: inr(data.staffPaymentsPending) },
    { key: "salary", label: "Salary paid to date", value: inr(data.salaryPaidToDate) },
    { key: "exp", label: "Total expenditure", value: inr(data.totalExpenditure) },
  ];

  return (
    <div className="widget">
      <p className="widget-title">Financial overview</p>
      <div className="stat-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.key}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value">{c.value}</div>
          </div>
        ))}
      </div>

      {data.expenditureByCategory.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: "0 0 8px" }}>Expenditure by category</p>
          <div className="mini-list">
            {data.expenditureByCategory.map((c) => (
              <div className="mini-row" key={c.category}>
                <span className="mini-title">{c.category}</span>
                <span className="mini-date">{inr(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
