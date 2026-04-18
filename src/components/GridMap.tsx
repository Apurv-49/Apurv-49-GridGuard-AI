import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { House, TransformerNode, Hotspot } from "@/lib/gridData";

interface Props {
  houses: House[];
  transformer: TransformerNode;
  hotspots: Hotspot[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

const riskColor = (level: House["risk_level"]) =>
  level === "high" ? "hsl(0 84% 60%)" : level === "medium" ? "hsl(38 95% 55%)" : "hsl(142 76% 45%)";

const houseIcon = (level: House["risk_level"], isTop5 = false) => {
  const c = riskColor(level);
  const pulse =
    level === "high"
      ? `<circle cx="16" cy="16" r="14" fill="${c}" opacity="0.25"><animate attributeName="r" from="10" to="${isTop5 ? 22 : 18}" dur="${isTop5 ? "1s" : "1.5s"}" repeatCount="indefinite"/><animate attributeName="opacity" from="0.6" to="0" dur="${isTop5 ? "1s" : "1.5s"}" repeatCount="indefinite"/></circle>`
      : "";
  const glowRing = isTop5
    ? `<circle cx="16" cy="16" r="13" fill="none" stroke="${c}" stroke-width="2.5" opacity="0.8"/>`
    : "";
  return L.divIcon({
    className: "",
    html: `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      ${pulse}
      ${glowRing}
      <circle cx="16" cy="16" r="10" fill="${c}" stroke="white" stroke-width="${isTop5 ? "2.5" : "2"}"/>
      <path d="M11 16 L16 11 L21 16 L21 21 L11 21 Z" fill="white"/>
    </svg>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const transformerIcon = L.divIcon({
  className: "",
  html: `<svg width="52" height="52" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
    <circle cx="26" cy="26" r="24" fill="hsl(180 100% 50%)" opacity="0.15">
      <animate attributeName="r" from="18" to="28" dur="2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="26" cy="26" r="18" fill="hsl(222 47% 7%)" stroke="hsl(180 100% 50%)" stroke-width="2.5"/>
    <path d="M24 15 L18 27 L24 27 L22 37 L34 23 L28 23 L30 15 Z" fill="hsl(180 100% 50%)"/>
  </svg>`,
  iconSize: [52, 52],
  iconAnchor: [26, 26],
});

function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo(pos, 16, { duration: 0.8 });
  }, [pos, map]);
  return null;
}

export default function GridMap({ houses, transformer, hotspots, selectedId, onSelect }: Props) {
  const center: [number, number] = [transformer.lat, transformer.lng];
  const top5Ids = useMemo(() => new Set(houses.slice(0, 5).map((h) => h.house_id)), [houses]);

  const selectedPos = useMemo<[number, number] | null>(() => {
    const h = houses.find((x) => x.house_id === selectedId);
    return h ? [h.lat, h.lng] : null;
  }, [selectedId, houses]);

  const lossPct = (transformer.loss_percentage * 100).toFixed(2);

  return (
    <MapContainer center={center} zoom={14} className="w-full h-full rounded-2xl" zoomControl={true}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Hotspot Circles */}
      {hotspots.map((h, i) => (
        <Circle
          key={i}
          center={[h.lat, h.lng]}
          radius={h.radius}
          pathOptions={{
            color: "hsl(0 84% 60%)",
            fillColor: "hsl(0 84% 60%)",
            fillOpacity: 0.12,
            weight: 2,
            dashArray: "6 6",
          }}
        >
          <Popup>
            <div className="font-semibold text-red-600">🔴 {h.label}</div>
          </Popup>
        </Circle>
      ))}

      {/* Connection lines from transformer to each house */}
      {houses.map((h) => (
        <Polyline
          key={`l-${h.house_id}`}
          positions={[[transformer.lat, transformer.lng], [h.lat, h.lng]]}
          pathOptions={{
            color: riskColor(h.risk_level),
            weight: h.risk_level === "high" ? 1.8 : 1,
            opacity: h.risk_level === "high" ? 0.6 : 0.2,
            dashArray: h.risk_level === "high" ? "4 6" : undefined,
          }}
        />
      ))}

      {/* Transformer marker */}
      <Marker position={[transformer.lat, transformer.lng]} icon={transformerIcon}>
        <Popup>
          <div className="space-y-1 min-w-[210px]">
            <div className="font-bold text-cyan-500 text-base">⚡ Distribution Transformer</div>
            <div className="border-t pt-1 space-y-0.5 text-xs">
              <div>Status: <b style={{ color: transformer.status === "Normal" ? "green" : "red" }}>{transformer.status}</b></div>
              <div>Loss: <b>{transformer.loss.toFixed(2)} kWh</b></div>
              <div>Loss %: <b>{lossPct}%</b></div>
              <div>Est. Revenue Loss: <b>₹{transformer.estimated_loss_in_rupees.toFixed(2)}</b></div>
            </div>
          </div>
        </Popup>
      </Marker>

      {/* House markers */}
      {houses.map((h) => {
        const isTop5 = top5Ids.has(h.house_id);
        return (
          <Marker
            key={h.house_id}
            position={[h.lat, h.lng]}
            icon={houseIcon(h.risk_level, isTop5)}
            eventHandlers={{ click: () => onSelect(h.house_id) }}
          >
            <Popup>
              <div className="space-y-1.5 min-w-[220px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-base">🏠 House #{h.house_id}</span>
                  <span
                    className="text-[10px] uppercase font-bold px-2 py-0.5 rounded"
                    style={{ background: riskColor(h.risk_level), color: "white" }}
                  >
                    {h.risk_level} risk
                  </span>
                </div>
                {isTop5 && (
                  <div className="text-[10px] font-bold text-amber-500 uppercase">
                    ⭐ Priority #{h.priority_rank} — Inspect First
                  </div>
                )}
                <div className="border-t pt-1.5 space-y-0.5 text-xs">
                  <div>Risk Score: <b style={{ color: riskColor(h.risk_level) }}>{h.risk_score}/100</b></div>
                  <div>Priority Rank: <b>#{h.priority_rank}</b></div>
                  <div>Confidence: <b>{h.confidence}</b></div>
                  <div className="pt-1">
                    <span className="font-semibold">Primary:</span> {h.reason.primary}
                  </div>
                  {h.reason.secondary.length > 0 && (
                    <div className="text-[10px] opacity-70">
                      {h.reason.secondary.join(" · ")}
                    </div>
                  )}
                  <div className="pt-1 border-t">
                    <div>Avg Consumption: <b>{h.average_consumption.toFixed(2)} kWh</b></div>
                    <div>Max Consumption: <b>{h.max_consumption.toFixed(2)} kWh</b></div>
                    <div>Night Usage: <b>{(h.night_usage_ratio * 100).toFixed(1)}%</b></div>
                    <div>Zone: <b>{h.zone}</b></div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <FlyTo pos={selectedPos} />
    </MapContainer>
  );
}
