import { Zap, Activity, Shield, BarChart3, Map, Brain, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Map, title: "Smart Grid Map", desc: "Live geospatial view of transformers and households with risk overlays." },
    { icon: Brain, title: "AI Anomaly Detection", desc: "ML-driven scoring identifies suspicious consumption patterns in real time." },
    { icon: BarChart3, title: "Predictive Analytics", desc: "Forecast losses and quantify recoverable revenue with one click." },
    { icon: Shield, title: "Inspection Priority", desc: "Auto-ranked top suspects so field teams act on the highest impact first." },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px]" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center glow-primary">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            GridGuard <span className="text-gradient">AI</span>
          </span>
        </div>
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="hidden md:inline-flex">
          Launch Dashboard <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-12 md:pt-24 pb-20">
        <div className="max-w-5xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-6 text-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">AI-Powered Grid Intelligence</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6">
            AI-Powered Electricity
            <br />
            <span className="text-gradient">Theft Detection</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Detect. Prioritize. Recover Revenue.
            <br />
            <span className="text-base md:text-lg opacity-80">
              Real-time anomaly detection across your distribution grid — powered by machine learning.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="bg-gradient-primary text-primary-foreground hover:opacity-90 glow-primary text-base h-12 px-8 font-semibold"
            >
              View Dashboard <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 glass border-primary/30">
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-20 max-w-3xl mx-auto">
            {[
              { value: "98.4%", label: "Detection Accuracy" },
              { value: "₹2.4Cr", label: "Avg. Annual Recovery" },
              { value: "<2s", label: "Real-time Alerts" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl p-5">
                <div className="text-2xl md:text-4xl font-bold text-gradient">{s.value}</div>
                <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="glass rounded-2xl p-6 hover:border-primary/40 transition-all hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/50 py-6 px-6 md:px-12 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          GridGuard AI — Securing the grid, one anomaly at a time.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
