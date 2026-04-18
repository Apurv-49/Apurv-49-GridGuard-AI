import { AlertCircle, Clock } from "lucide-react";

interface Event {
  id: string;
  time: string;
  house: string;
  reason: string;
  severity: number;
  zone: string;
}

export default function AnomalyTimeline({ events }: { events: Event[] }) {
  const severityColor = (s: number) =>
    s >= 80 ? "text-red-500" : s >= 65 ? "text-orange-500" : "text-yellow-500";

  const dotColor = (s: number) =>
    s >= 80 ? "bg-red-500 ring-red-500/20" : s >= 65 ? "bg-orange-500 ring-orange-500/20" : "bg-yellow-500 ring-yellow-500/20";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-destructive/20 border border-destructive/40 flex items-center justify-center">
          <Clock className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold">Anomaly Timeline</h3>
          <p className="text-xs text-muted-foreground">Real-time suspicious events</p>
        </div>
      </div>

      <div className="relative space-y-3 max-h-[260px] overflow-y-auto pr-1">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
        {events.length === 0 && (
          <div className="pl-6 text-xs text-muted-foreground italic">No anomalies detected.</div>
        )}
        {events.map((e) => (
          <div key={e.id} className="relative pl-6 animate-slide-in-right">
            <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full ring-4 animate-pulse ${dotColor(e.severity)}`} />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground">{e.time} · {e.zone}</div>
                <div className="text-sm font-medium truncate">{e.house}</div>
                <div className={`text-xs flex items-center gap-1 mt-0.5 ${severityColor(e.severity)}`}>
                  <AlertCircle className="w-3 h-3" /> {e.reason}
                </div>
              </div>
              <div className={`text-xs font-bold shrink-0 ${severityColor(e.severity)}`}>
                {e.severity}/100
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
