import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Zap,
  ArrowLeft,
  AlertTriangle,
  Activity,
  Download,
  Bell,
  Gauge,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import GridMap from "@/components/GridMap";
import AIInsights from "@/components/AIInsights";
import SimulationControls from "@/components/SimulationControls";
import AnomalyTimeline from "@/components/AnomalyTimeline";
import { ConsumptionChart, RiskDistributionChart } from "@/components/Charts";
import {
  detectHotspots,
  generateTimeSeries,
  generateAnomalyTimeline,
  type FullData,
} from "@/lib/gridData";
import { fetchAllHouses, runSimulation } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-secondary/50 ${className}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated counter
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    const duration = 600;
    const step = 16;
    const increment = (end - start) / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, step);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();

  // Data state
  const [data, setData] = useState<FullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState(true);

  // Simulation state
  const [theftLevel, setTheftLevel] = useState(0);
  const [simRunning, setSimRunning] = useState(false);

  // UI state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── Fetch baseline data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllHouses();
      setData(result);
      setApiOnline(true);
      setLastUpdated(new Date());
    } catch (err) {
      setApiOnline(false);
      setError("Cannot reach backend. Make sure the FastAPI server is running on port 8000.");
      toast.error("⚠️ Backend offline", {
        description: "Start the API: python api.py",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Alert on high-risk loads ──
  useEffect(() => {
    if (data) {
      const h = data.insights.top_5_houses[0];
      if (h && data.insights.total_high_risk > 0) {
        toast.error(`🚨 ${data.insights.total_high_risk} High-Risk Houses Detected`, {
          description: `Top suspect: House #${h.house_id} — ${h.reason.primary} (score: ${h.risk_score}/100)`,
        });
      }
    }
  }, [data?.insights.total_high_risk]);

  // ── Derived / memoized values ──
  const hotspots = useMemo(() => data ? detectHotspots(data.houses) : [], [data]);
  const timeSeries = useMemo(() => data ? generateTimeSeries(data) : [], [data]);
  const timeline = useMemo(() => data ? generateAnomalyTimeline(data.houses) : [], [data]);

  // ── Run simulation ──
  const handleRunSimulation = async () => {
    if (!apiOnline) {
      toast.error("Backend is offline");
      return;
    }
    setSimRunning(true);
    toast.info("⚙️ Running theft increase simulation...");
    try {
      const result = await runSimulation(theftLevel);
      setData(result);
      setLastUpdated(new Date());
      toast.success(`✅ Simulation done — theft +${theftLevel}% applied`, {
        description: `High risk houses: ${result.insights.total_high_risk} | Loss: ₹${result.insights.estimated_loss.toFixed(2)}`,
      });
    } catch {
      toast.error("Simulation failed. Is the API running?");
    } finally {
      setSimRunning(false);
    }
  };

  // ── Reset ──
  const handleReset = async () => {
    setTheftLevel(0);
    setSelectedId(null);
    await loadData();
    toast.info("🔄 Grid reset to ML baseline.");
  };

  // ── Download CSV report ──
  const downloadReport = () => {
    if (!data) return;
    const lines = [
      "Electricity Theft Detection Report — GridGuard AI",
      `Generated: ${new Date().toLocaleString()}`,
      `Transformer Loss: ${data.transformer.loss.toFixed(4)} kWh | Loss %: ${(data.transformer.loss_percentage * 100).toFixed(2)}%`,
      `Estimated Revenue Loss: ₹${data.transformer.estimated_loss_in_rupees}`,
      `Zone Status: ${data.transformer.status}`,
      `High Risk Houses: ${data.insights.total_high_risk}`,
      "",
      "house_id,risk_score,risk_level,priority_rank,confidence,primary_reason,secondary_reasons,zone,avg_consumption,max_consumption,night_ratio,lat,lng",
      ...data.houses.map(
        (h) =>
          `${h.house_id},${h.risk_score},${h.risk_level},${h.priority_rank},"${h.confidence}","${h.reason.primary}","${h.reason.secondary.join("; ")}","${h.zone}",${h.average_consumption},${h.max_consumption},${h.night_usage_ratio},${h.lat},${h.lng}`
      ),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `theft-detection-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("📄 Report downloaded.");
  };

  // ─────────────────────────────────────────────
  // Render: Error / Loading
  // ─────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="glass rounded-2xl p-8 max-w-md text-center space-y-4">
          <WifiOff className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">Backend Offline</h2>
          <p className="text-muted-foreground text-sm">{error}</p>
          <div className="bg-secondary/40 rounded-xl p-3 text-xs font-mono text-left">
            <div className="text-muted-foreground">Run in terminal:</div>
            <div className="text-primary mt-1">pip install fastapi uvicorn</div>
            <div className="text-primary">python api.py</div>
          </div>
          <Button onClick={loadData} className="w-full bg-gradient-primary">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry Connection
          </Button>
          <Button variant="outline" onClick={() => navigate("/")} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Stats for header strip
  // ─────────────────────────────────────────────
  const stats = data
    ? [
        {
          icon: Zap,
          label: "Est. Loss",
          value: `₹${data.insights.estimated_loss.toFixed(2)}`,
          color: "text-destructive",
        },
        {
          icon: Activity,
          label: "Loss %",
          value: `${(data.transformer.loss_percentage * 100).toFixed(2)}%`,
          color: "text-warning",
        },
        {
          icon: AlertTriangle,
          label: "High Risk",
          value: `${data.insights.total_high_risk} houses`,
          color: "text-destructive",
        },
        {
          icon: Gauge,
          label: "Zone Status",
          value: data.transformer.status,
          color: data.transformer.status === "Normal" ? "text-success" : "text-destructive",
        },
      ]
    : [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="glass-strong sticky top-0 z-20 border-b border-border/50">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center glow-primary">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold leading-tight">
                  GridGuard <span className="text-gradient">AI</span>
                </h1>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  ML Theft Detection · Chandigarh Grid
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* API status */}
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${
                apiOnline
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {apiOnline ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span className="font-medium">API Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span className="font-medium">API Offline</span>
                </>
              )}
            </div>

            {lastUpdated && (
              <div className="hidden md:block text-[10px] text-muted-foreground">
                Updated {lastUpdated.toLocaleTimeString()}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={loadData} className="border-primary/30" disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={downloadReport} className="border-primary/30" disabled={!data}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Report
            </Button>
            <Button variant="outline" size="icon" className="relative border-primary/30">
              <Bell className="w-4 h-4" />
              {data && data.insights.total_high_risk > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  {data.insights.total_high_risk}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-4 md:px-6 pb-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            : stats.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 rounded-xl bg-secondary/40 border border-border/50 px-3 py-2"
                >
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.label}
                    </div>
                    <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                  </div>
                </div>
              ))}
        </div>
      </header>

      {/* ── Main grid ── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 md:p-6">
        {/* Map section */}
        <section className="lg:col-span-8 space-y-4">
          <div className="glass rounded-2xl p-1.5 h-[480px] lg:h-[560px] relative overflow-hidden">
            {loading || !data ? (
              <Skeleton className="w-full h-full" />
            ) : (
              <GridMap
                houses={data.houses}
                transformer={data.transformer}
                hotspots={hotspots}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            {/* Legend */}
            {data && (
              <div className="absolute bottom-4 left-4 z-[400] glass-strong rounded-xl px-3 py-2 text-xs space-y-1">
                <div className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Risk Levels
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-risk-high" /> High ({data.houses.filter((h) => h.risk_level === "high").length})
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-risk-medium" /> Medium ({data.houses.filter((h) => h.risk_level === "medium").length})
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-risk-low" /> Low ({data.houses.filter((h) => h.risk_level === "low").length})
                </div>
                {hotspots.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                    <span className="w-2.5 h-2.5 rounded-full border border-destructive bg-destructive/20" />
                    Clusters ({hotspots.length})
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Expected vs Consumed</h3>
                  <p className="text-xs text-muted-foreground">24-hour estimated load curve</p>
                </div>
                <Gauge className="w-4 h-4 text-primary" />
              </div>
              {loading ? <Skeleton className="h-[220px]" /> : <ConsumptionChart data={timeSeries} />}
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">Risk Distribution</h3>
                  <p className="text-xs text-muted-foreground">Houses per risk score band</p>
                </div>
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              {loading ? <Skeleton className="h-[220px]" /> : data && <RiskDistributionChart houses={data.houses} />}
            </div>
          </div>
        </section>

        {/* Right sidebar */}
        <aside className="lg:col-span-4 space-y-4">
          <SimulationControls
            theftLevel={theftLevel}
            onChange={setTheftLevel}
            onRun={handleRunSimulation}
            onReset={handleReset}
            running={simRunning}
            disabled={!apiOnline}
          />
          {loading ? (
            <Skeleton className="h-80" />
          ) : (
            data && (
              <AIInsights
                houses={data.houses}
                estimatedLoss={data.insights.estimated_loss}
                totalHighRisk={data.insights.total_high_risk}
                onSelect={setSelectedId}
              />
            )
          )}
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <AnomalyTimeline events={timeline} />
          )}
        </aside>
      </main>
    </div>
  );
};

export default Dashboard;
