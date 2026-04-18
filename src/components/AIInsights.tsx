import { Brain, TrendingDown, IndianRupee, ArrowRight, AlertOctagon } from "lucide-react";
import { House } from "@/lib/gridData";

interface Props {
  houses: House[];
  estimatedLoss: number;
  totalHighRisk: number;
  onSelect: (id: number) => void;
}

const riskColor = (level: House["risk_level"]) =>
  level === "high" ? "hsl(0 84% 60%)" : level === "medium" ? "hsl(38 95% 55%)" : "hsl(142 76% 45%)";

export default function AIInsights({ houses, estimatedLoss, totalHighRisk, onSelect }: Props) {
  const top5 = [...houses].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);
  const savingsEstimate = estimatedLoss * 0.4; // 40% recoverable

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-accent flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">AI Insights</h3>
          <p className="text-xs text-muted-foreground">ML-powered inspection intelligence</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3">
          <div className="flex items-center gap-1.5 text-xs text-destructive mb-1">
            <IndianRupee className="w-3 h-3" /> Est. Revenue Loss
          </div>
          <div className="text-xl font-bold text-destructive">
            ₹{estimatedLoss.toFixed(0)}
            <span className="text-xs font-normal opacity-70">/cycle</span>
          </div>
        </div>
        <div className="rounded-xl bg-warning/10 border border-warning/30 p-3">
          <div className="flex items-center gap-1.5 text-xs text-warning mb-1">
            <AlertOctagon className="w-3 h-3" /> High Risk
          </div>
          <div className="text-xl font-bold text-warning">
            {totalHighRisk}
            <span className="text-xs font-normal opacity-70"> houses</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-success/10 border border-success/30 p-3 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-success mb-1">
          <TrendingDown className="w-3 h-3" /> Potential Recovery (Inspection)
        </div>
        <div className="text-lg font-bold text-success">
          ₹{savingsEstimate.toFixed(0)}
          <span className="text-xs font-normal opacity-70"> recoverable</span>
        </div>
      </div>

      {/* Top 5 inspection priority */}
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
        🎯 Inspection Priority List
      </div>
      <div className="space-y-1.5">
        {top5.map((h, i) => (
          <button
            key={h.house_id}
            onClick={() => onSelect(h.house_id)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40 hover:bg-secondary border border-transparent hover:border-primary/30 transition-all group text-left"
          >
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${riskColor(h.risk_level)}, hsl(0 84% 40%))` }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">House #{h.house_id}</div>
              <div className="text-xs text-muted-foreground truncate">
                {h.reason.primary}
                {h.reason.secondary.length > 0 && ` · ${h.reason.secondary[0]}`}
              </div>
              <div className="text-[10px] text-muted-foreground">{h.zone}</div>
            </div>
            <div className="text-right shrink-0">
              <div
                className="text-sm font-bold"
                style={{ color: riskColor(h.risk_level) }}
              >
                {h.risk_score}/100
              </div>
              <div className="text-[10px] text-muted-foreground">{h.confidence.split(" ")[0]}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
