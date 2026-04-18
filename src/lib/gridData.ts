// ─────────────────────────────────────────────────────────────────────────────
// Types that match the real ML backend JSON (theft_detection_results_v3.json)
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = "high" | "medium" | "low";

export interface HouseReason {
  primary: string;
  secondary: string[];
}

export interface House {
  house_id: number;
  lat: number;
  lng: number;
  risk_score: number;           // 0-100
  risk_level: RiskLevel;
  priority_rank: number;
  reason: HouseReason;
  confidence: string;           // e.g. "very high (≥80%)"
  zone: string;
  anomaly_score: number;
  average_consumption: number;
  max_consumption: number;
  std_consumption: number;
  night_usage_ratio: number;
  consumption_difference: number;
  transformer_load_share: number;
}

export interface TransformerNode {
  type: string;
  lat: number;
  lng: number;
  loss: number;
  loss_percentage: number;
  status: string;
  estimated_loss_in_rupees: number;
}

export interface TransformerMetrics {
  total_house_consumption: number;
  expected_transformer_load: number;
  transformer_loss: number;
  loss_ratio: number;
  zone_status: string;
  estimated_loss_in_rupees: number;
}

export interface Insights {
  top_5_houses: House[];
  total_high_risk: number;
  zone_status: string;
  estimated_loss: number;
}

export interface FullData {
  transformer: TransformerNode;
  transformer_metrics: TransformerMetrics;
  insights: Insights;
  houses: House[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hotspot detection (runs client-side on real data)
// ─────────────────────────────────────────────────────────────────────────────

export interface Hotspot {
  lat: number;
  lng: number;
  radius: number; // meters
  count: number;
  label: string;
}

export function detectHotspots(houses: House[]): Hotspot[] {
  const high = houses.filter((h) => h.risk_level === "high");
  const clusters: Hotspot[] = [];
  const used = new Set<number>();

  for (let i = 0; i < high.length; i++) {
    if (used.has(i)) continue;
    let lat = high[i].lat;
    let lng = high[i].lng;
    let count = 1;
    used.add(i);

    for (let j = i + 1; j < high.length; j++) {
      if (used.has(j)) continue;
      const d = Math.hypot(high[i].lat - high[j].lat, high[i].lng - high[j].lng);
      if (d < 0.006) {
        lat += high[j].lat;
        lng += high[j].lng;
        count++;
        used.add(j);
      }
    }

    if (count >= 2) {
      clusters.push({
        lat: lat / count,
        lng: lng / count,
        radius: 200 + count * 80,
        count,
        label: `High Risk Cluster (${count} houses)`,
      });
    }
  }
  return clusters;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time-series generator (derives 24h chart data from real house metrics)
// ─────────────────────────────────────────────────────────────────────────────

export function generateTimeSeries(data: FullData) {
  const totalConsumed = data.transformer_metrics.total_house_consumption;
  const totalExpected = data.transformer_metrics.expected_transformer_load;
  const series = [];

  for (let h = 0; h < 24; h++) {
    const dayFactor = 0.5 + 0.5 * Math.sin(((h - 6) / 24) * Math.PI * 2) + (h >= 18 && h <= 22 ? 0.3 : 0);
    const supplied = +((totalExpected / 24) * dayFactor * 24 * (0.9 + Math.random() * 0.15)).toFixed(1);
    const consumed = +((totalConsumed / 24) * dayFactor * 24 * (0.9 + Math.random() * 0.15)).toFixed(1);
    series.push({
      hour: `${String(h).padStart(2, "0")}:00`,
      supplied,
      consumed,
      loss: +(Math.abs(supplied - consumed)).toFixed(1),
    });
  }
  return series;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anomaly timeline events
// ─────────────────────────────────────────────────────────────────────────────

export function generateAnomalyTimeline(houses: House[]) {
  return houses
    .filter((h) => h.risk_level === "high")
    .slice(0, 8)
    .map((h, i) => ({
      id: `EV-${i + 1}`,
      time: `${22 - i}:${String(15 + i * 7).padStart(2, "0")}`,
      house: `H-${h.house_id}`,
      reason: `${h.reason.primary}${h.reason.secondary.length ? " · " + h.reason.secondary[0] : ""}`,
      severity: h.risk_score,
      zone: h.zone,
    }));
}
