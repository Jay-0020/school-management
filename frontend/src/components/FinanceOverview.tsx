import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Donut } from "./charts";
import { CountUp } from "./CountUp";
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
    { key: "fees", label: "Student fees pending", value: data.feesPending },
    { key: "staffpay", label: "Staff payments pending", value: data.staffPaymentsPending },
    { key: "salary", label: "Salary paid to date", value: data.salaryPaidToDate },
    { key: "exp", label: "Total expenditure", value: data.totalExpenditure },
  ];

  return (
    <div className="widget">
      <p className="widget-title">Financial Overview</p>
      <div className="stat-grid">
        {cards.map((c) => (
          <div className="stat-card" key={c.key}>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value"><CountUp value={c.value} format={inr} /></div>
          </div>
        ))}
      </div>

      {data.expenditureByCategory.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: "0 0 10px" }}>Expenditure by category</p>
          <Donut
            data={data.expenditureByCategory.map((c) => ({ label: c.category, value: c.total }))}
            center={inr(data.totalExpenditure)}
          />
        </div>
      )}
    </div>
  );
}
