import { Sliders, Play, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

interface Props {
  theftLevel: number;
  onChange: (v: number) => void;
  onRun: () => void;
  onReset: () => void;
  running: boolean;
  disabled?: boolean;
}

export default function SimulationControls({
  theftLevel,
  onChange,
  onRun,
  onReset,
  running,
  disabled = false,
}: Props) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center glow-primary">
          <Sliders className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Simulation Controls</h3>
          <p className="text-xs text-muted-foreground">Stress-test theft scenarios via ML</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Theft Injection Level</span>
          <span className="font-bold text-primary">+{theftLevel}%</span>
        </div>
        <Slider
          value={[theftLevel]}
          onValueChange={(v) => onChange(v[0])}
          min={0}
          max={50}
          step={1}
          disabled={disabled}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Baseline (0%)</span>
          <span>Severe (+50%)</span>
        </div>
      </div>

      {/* Theft level labels */}
      <div className="mb-4 text-center">
        <span
          className={`text-xs px-3 py-1 rounded-full font-semibold ${
            theftLevel === 0
              ? "bg-success/10 text-success border border-success/30"
              : theftLevel < 20
              ? "bg-warning/10 text-warning border border-warning/30"
              : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}
        >
          {theftLevel === 0 ? "No Simulation" : theftLevel < 20 ? "Moderate Theft" : "Severe Theft"}
        </span>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onRun}
          disabled={running || disabled || theftLevel === 0}
          className="flex-1 bg-gradient-primary text-primary-foreground hover:opacity-90 font-semibold"
        >
          <Play className="w-3.5 h-3.5 mr-2" />
          {running ? "Simulating..." : "Run Simulation"}
        </Button>
        <Button
          onClick={onReset}
          variant="outline"
          size="icon"
          className="border-primary/30"
          disabled={running}
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {disabled && (
        <p className="text-[10px] text-destructive text-center mt-2">
          Backend offline — simulation unavailable
        </p>
      )}
    </div>
  );
}
