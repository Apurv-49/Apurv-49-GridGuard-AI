import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { House } from "@/lib/gridData";

const tooltipStyle = {
  contentStyle: {
    background: "hsl(222 40% 9%)",
    border: "1px solid hsl(180 100% 50% / 0.3)",
    borderRadius: 12,
    fontSize: 12,
  },
  labelStyle: { color: "hsl(180 100% 65%)", fontWeight: 600 },
};

export function ConsumptionChart({
  data,
}: {
  data: { hour: string; supplied: number; consumed: number; loss: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gSup" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(180 100% 50%)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(180 100% 50%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gCon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(270 95% 65%)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="hsl(270 95% 65%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(217 32% 18%)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="hour" tick={{ fill: "hsl(215 20% 65%)", fontSize: 11 }} interval={2} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(215 20% 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Area type="monotone" dataKey="supplied" stroke="hsl(180 100% 50%)" strokeWidth={2} fill="url(#gSup)" name="Expected (kWh)" />
        <Area type="monotone" dataKey="consumed" stroke="hsl(270 95% 65%)" strokeWidth={2} fill="url(#gCon)" name="Consumed (kWh)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RiskDistributionChart({ houses }: { houses: House[] }) {
  const buckets = [
    { range: "0–20", count: 0, color: "hsl(142 76% 45%)" },
    { range: "20–40", count: 0, color: "hsl(142 76% 45%)" },
    { range: "40–60", count: 0, color: "hsl(38 95% 55%)" },
    { range: "60–80", count: 0, color: "hsl(0 84% 60%)" },
    { range: "80–100", count: 0, color: "hsl(0 60% 45%)" },
  ];

  houses.forEach((h) => {
    const idx = Math.min(4, Math.floor(h.risk_score / 20));
    buckets[idx].count++;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={buckets} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="hsl(217 32% 18%)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="range" tick={{ fill: "hsl(215 20% 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(215 20% 65%)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(180 100% 50% / 0.05)" }} />
        <Bar dataKey="count" name="Houses" radius={[8, 8, 0, 0]}>
          {buckets.map((b, i) => (
            <Cell key={i} fill={b.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
