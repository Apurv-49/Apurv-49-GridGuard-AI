"""
Electricity Theft Detection System - FastAPI Backend
Serves ML results from theft_detection_results_v3.json with simulation support.
"""
import json
import copy
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────
# App setup
# ─────────────────────────────────────────────
app = FastAPI(
    title="Electricity Theft Detection API",
    description="Real-time electricity theft detection powered by ML",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Load JSON data once at startup
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
JSON_PATH = BASE_DIR / "theft_detection_results_v3.json"

_cached_data: dict | None = None

def get_base_data() -> dict:
    global _cached_data
    if _cached_data is None:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            _cached_data = json.load(f)
    return _cached_data


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────
class SimulateRequest(BaseModel):
    percent: float  # 0–50


# ─────────────────────────────────────────────
# Helper: simulate theft increase (dramatically visual)
# ─────────────────────────────────────────────
def simulate_theft_increase(base_data: dict, percent: float) -> dict:
    """
    Boosts risk scores aggressively so map colors change visibly.
    
    Boost strategy (multiplicative so map changes colors dramatically):
      - Low risk  (< 35):  factor = 3.5   → house at 22 at 50% → 22 * (1 + 0.5*3.5) = 60.5 = MEDIUM
      - Medium    (35–64): factor = 1.8   → house at 40 at 30% → 40 * (1 + 0.3*1.8) = 61.6 = MEDIUM→HIGH
      - High risk (≥ 65):  factor = 0.6   → house at 77 at 30% → 77 * (1 + 0.3*0.6) = 90.9 = HIGH (cap 100)
    """
    data = copy.deepcopy(base_data)
    p = percent / 100.0  # normalised 0–1

    updated_houses = []
    for house in data["houses"]:
        h = copy.deepcopy(house)
        base_risk = h["risk_score"]

        # Choose boost factor by band
        if base_risk < 35:
            factor = 3.5
        elif base_risk < 65:
            factor = 1.8
        else:
            factor = 0.6

        new_risk = base_risk * (1 + p * factor)
        h["risk_score"] = min(100, round(new_risk))

        # Update risk level based on new score
        if h["risk_score"] >= 65:
            h["risk_level"] = "high"
        elif h["risk_score"] >= 35:
            h["risk_level"] = "medium"
        else:
            h["risk_level"] = "low"

        # Boost consumption proportionally
        h["average_consumption"] = round(h["average_consumption"] * (1 + p * 0.5), 4)
        h["max_consumption"] = round(h["max_consumption"] * (1 + p * 0.6), 4)
        h["consumption_difference"] = round(h["consumption_difference"] * (1 + p * 0.4), 4)

        updated_houses.append(h)

    # Re-sort by risk score descending
    updated_houses.sort(key=lambda x: x["risk_score"], reverse=True)

    # Re-rank priority
    for idx, h in enumerate(updated_houses):
        h["priority_rank"] = idx + 1

    # Update top 5
    top5 = [copy.deepcopy(h) for h in updated_houses[:5]]

    # Update transformer metrics (scale with sim percent)
    base_loss = base_data["transformer"]["loss"]
    base_loss_pct = base_data["transformer"]["loss_percentage"]
    base_est_loss = base_data["transformer"]["estimated_loss_in_rupees"]

    loss_multiplier = 1 + p * 1.5   # more dramatic: 50% sim → 1.75x loss
    loss_boost = round(base_loss * loss_multiplier, 4)
    loss_pct = round(base_loss_pct * loss_multiplier, 4)
    est_loss = round(base_est_loss * loss_multiplier, 2)

    new_status = "Normal"
    if loss_pct > 0.12:
        new_status = "Critical"
    elif loss_pct > 0.06:
        new_status = "Warning"

    data["transformer"]["loss"] = loss_boost
    data["transformer"]["loss_percentage"] = loss_pct
    data["transformer"]["estimated_loss_in_rupees"] = est_loss
    data["transformer"]["status"] = new_status

    data["transformer_metrics"]["transformer_loss"] = loss_boost
    data["transformer_metrics"]["loss_ratio"] = loss_pct
    data["transformer_metrics"]["estimated_loss_in_rupees"] = est_loss
    data["transformer_metrics"]["zone_status"] = new_status
    data["transformer_metrics"]["total_house_consumption"] = round(
        base_data["transformer_metrics"]["total_house_consumption"] * (1 + p * 0.3), 4
    )

    high_count = sum(1 for h in updated_houses if h["risk_level"] == "high")
    data["insights"]["top_5_houses"] = top5
    data["insights"]["total_high_risk"] = high_count
    data["insights"]["estimated_loss"] = est_loss
    data["insights"]["zone_status"] = new_status

    data["houses"] = updated_houses

    return data


# ─────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "⚡ Electricity Theft Detection API v3.0 - Online"}


@app.get("/api/houses")
def get_all_houses():
    """Returns full detection result: transformer, metrics, insights, all houses."""
    return get_base_data()


@app.get("/api/insights")
def get_insights():
    """Returns top 5 houses, total high risk count, estimated loss."""
    data = get_base_data()
    return {
        "top_5_houses": data["insights"]["top_5_houses"],
        "total_high_risk": data["insights"]["total_high_risk"],
        "estimated_loss": data["insights"]["estimated_loss"],
        "zone_status": data["insights"]["zone_status"],
    }


@app.get("/api/transformer")
def get_transformer():
    """Returns transformer node data."""
    data = get_base_data()
    return {
        "transformer": data["transformer"],
        "transformer_metrics": data["transformer_metrics"],
    }


@app.post("/api/simulate")
def simulate(req: SimulateRequest):
    """
    Simulates a theft increase by the given percentage.
    Input: { "percent": 20 }
    Returns: updated full dataset with new risk levels and colors.
    """
    if req.percent < 0 or req.percent > 100:
        raise HTTPException(status_code=400, detail="percent must be between 0 and 100")

    base = get_base_data()
    result = simulate_theft_increase(base, req.percent)
    return result


# ─────────────────────────────────────────────
# Dev runner
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
