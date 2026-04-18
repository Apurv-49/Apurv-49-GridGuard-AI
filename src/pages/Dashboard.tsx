import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  X,
  AlertCircle,
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
// Notification panel (bell dropdown)
// ─────────────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
  time: Date;
  read: boolean;
}

function NotificationPanel({
  notifications,
  onClose,
  onMarkRead,
  onClearAll,
}: {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const colorMap = {
    error: "text-destructive border-destructive/30 bg-destructive/10",
    warning: "text-warning border-warning/30 bg-warning/10",
    info: "text-primary border-primary/30 bg-primary/10",
  };

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-2 w-80 z-[500] glass-strong rounded-2xl border border-border/50 shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="font-semibold text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          Notifications
          {notifications.filter((n) => !n.read).length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-white">
              {notifications.filter((n) => !n.read).length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              Clear all
            </button>
          )}
          <button onClick={onClose}>
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => onMarkRead(n.id)}
              className={`px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-secondary/30 transition-colors ${
                !n.read ? "bg-secondary/20" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${
                  n.type === "error" ? "text-destructive" :
                  n.type === "warning" ? "text-warning" : "text-primary"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {n.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {n.time.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
  // Key that changes after each simulation → forces GridMap to re-mount with new markers
  const [mapKey, setMapKey] = useState(0);

  // UI state
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ── Helpers ──
  const addNotification = useCallback((n: Omit<Notification, "id" | "time" | "read">) => {
    const notif: Notification = {
      ...n,
      id: Date.now().toString(),
      time: new Date(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev].slice(0, 20)); // keep last 20
  }, []);

  // ── Fetch baseline data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAllHouses();
      setData(result);
      setApiOnline(true);
      setLastUpdated(new Date());
      setMapKey((k) => k + 1); // force map re-mount on fresh data
    } catch {
      setApiOnline(false);
      setError("Cannot reach backend. Make sure the FastAPI server is running on port 8000.");
      toast.error("⚠️ Backend offline", {
        description: "Run: python api.py in the HELIX HACK folder",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Fire notification + toast when data first loads ──
  const initialLoadFired = useRef(false);
  useEffect(() => {
    if (data && !initialLoadFired.current) {
      initialLoadFired.current = true;
      const h = data.insights.top_5_houses[0];
      if (h) {
        const msg = `${data.insights.total_high_risk} High-Risk Houses Detected`;
        const desc = `Top suspect: House #${h.house_id} — ${h.reason.primary} (score: ${h.risk_score}/100)`;

        // Show toast
        toast.error(`🚨 ${msg}`, { description: desc });

        // Add to notification panel
        addNotification({ type: "error", title: `🚨 ${msg}`, description: desc });

        // Add zone notification
        addNotification({
          type: "info",
          title: "ML Analysis Complete",
          description: `${data.houses.length} houses scanned · Zone: ${data.transformer.status} · Loss: ₹${data.insights.estimated_loss.toFixed(2)}`,
        });
      }
    }
  }, [data, addNotification]);

  // ── Derived / memoized values ──
  const hotspots = useMemo(() => (data ? detectHotspots(data.houses) : []), [data]);
  const timeSeries = useMemo(() => (data ? generateTimeSeries(data) : []), [data]);
  const timeline = useMemo(() => (data ? generateAnomalyTimeline(data.houses) : []), [data]);

  // ── Run simulation ──
  const handleRunSimulation = async () => {
    if (!apiOnline) {
      toast.error("Backend is offline — start python api.py");
      return;
    }
    if (theftLevel === 0) {
      toast.warning("⚠️ Set theft level above 0% first using the slider");
      return;
    }
    setSimRunning(true);
    toast.loading(`⚙️ Simulating +${theftLevel}% theft increase...`, { id: "sim" });
    try {
      const result = await runSimulation(theftLevel);
      setData(result);
      setLastUpdated(new Date());
      setMapKey((k) => k + 1); // ← KEY FIX: forces GridMap full re-mount so new marker colors appear

      const newHigh = result.insights.total_high_risk;
      const prevHigh = data?.insights.total_high_risk ?? 0;
      const newlyHigh = newHigh - prevHigh;

      toast.success(`✅ Simulation complete — +${theftLevel}% theft applied`, {
        id: "sim",
        description: `High risk: ${newHigh} houses (+${Math.max(0, newlyHigh)} new) · Loss: ₹${result.insights.estimated_loss.toFixed(2)} · Zone: ${result.transformer.status}`,
      });

      addNotification({
        type: newlyHigh > 0 ? "error" : "warning",
        title: `Simulation +${theftLevel}%: Zone now ${result.transformer.status}`,
        description: `${newHigh} high-risk houses · Est. loss ₹${result.insights.estimated_loss.toFixed(2)} · ${newlyHigh > 0 ? `${newlyHigh} newly flagged` : "Risk scores elevated"}`,
      });
    } catch {
      toast.error("Simulation failed — is the API running?", { id: "sim" });
    } finally {
      setSimRunning(false);
    }
  };

  // ── Reset ──
  const handleReset = async () => {
    setTheftLevel(0);
    setSelectedId(null);
    toast.info("🔄 Resetting to ML baseline...");
    await loadData();
    initialLoadFired.current = false; // allow reload notification
    addNotification({
      type: "info",
      title: "Grid Reset",
      description: "Restored to original ML baseline data",
    });
  };

  // ── Download CSV report ──
  const downloadReport = () => {
    if (!data) {
      toast.warning("No data available to download");
      return;
    }
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
    toast.success("📄 Report downloaded successfully");
  };

  // ── Bell button: toggle notification panel ──
  const handleBellClick = () => {
    setShowNotifications((v) => !v);
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleClearAll = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

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
            <div className="text-primary mt-1">cd "HELIX HACK"</div>
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
          color:
            data.transformer.status === "Normal"
              ? "text-success"
              : data.transformer.status === "Warning"
              ? "text-warning"
              : "text-destructive",
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
            {/* API status indicator */}
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-default ${
                apiOnline
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {apiOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
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

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="border-primary/30"
              disabled={loading}
              title="Refresh data from ML backend"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={downloadReport}
              className="border-primary/30"
              disabled={!data}
              title="Download CSV report"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Report
            </Button>

            {/* Bell notification button */}
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                className="relative border-primary/30"
                onClick={handleBellClick}
                title="View notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              {/* Notification dropdown panel */}
              {showNotifications && (
                <NotificationPanel
                  notifications={notifications}
                  onClose={() => setShowNotifications(false)}
                  onMarkRead={handleMarkRead}
                  onClearAll={handleClearAll}
                />
              )}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-4 md:px-6 pb-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            : stats.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 rounded-xl bg-secondary/40 border border-border/50 px-3 py-2 transition-all hover:border-primary/30"
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
              // key={mapKey} forces a full re-mount every time simulation runs
              // This guarantees Leaflet markers re-render with new colors
              <GridMap
                key={mapKey}
                houses={data.houses}
                transformer={data.transformer}
                hotspots={hotspots}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            {/* Risk legend */}
            {data && (
              <div className="absolute bottom-4 left-4 z-[400] glass-strong rounded-xl px-3 py-2 text-xs space-y-1">
                <div className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Risk Levels
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-risk-high animate-pulse" />
                  High ({data.houses.filter((h) => h.risk_level === "high").length})
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-risk-medium" />
                  Medium ({data.houses.filter((h) => h.risk_level === "medium").length})
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-risk-low" />
                  Low ({data.houses.filter((h) => h.risk_level === "low").length})
                </div>
                {hotspots.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                    <span className="w-2.5 h-2.5 rounded-full border border-destructive bg-destructive/20" />
                    Clusters ({hotspots.length})
                  </div>
                )}
              </div>
            )}

            {/* Simulation mode badge */}
            {data && theftLevel > 0 && (
              <div className="absolute top-4 right-4 z-[400]">
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  theftLevel >= 30
                    ? "bg-destructive/20 border-destructive/50 text-destructive"
                    : "bg-warning/20 border-warning/50 text-warning"
                } animate-pulse`}>
                  ⚡ SIM +{theftLevel}% Active
                </div>
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
              {loading ? (
                <Skeleton className="h-[220px]" />
              ) : (
                data && <RiskDistributionChart houses={data.houses} />
              )}
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
                onSelect={(id) => {
                  setSelectedId(id);
                  toast.info(`📍 Flying to House #${id} on map`);
                }}
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
