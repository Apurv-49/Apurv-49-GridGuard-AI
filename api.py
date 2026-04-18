"""
Electricity Theft Detection System - FastAPI Backend
Serves ML results from theft_detection_results_v3.json with simulation support.
"""
import json
import copy
import random
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from functools import lru_cache

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

def load_data() -> dict:
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

_cached_data: dict | None = None

def get_base_data() -> dict:
    global _cached_data
    if _cached_data is None:
        _cached_data = load_data()
    return _cached_data


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────
class SimulateRequest(BaseModel):
    percent: float  # 10–50 recommended


# ─────────────────────────────────────────────
# Helper: simulate theft increase
# ─────────────────────────────────────────────
def simulate_theft_increase(base_data: dict, percent: float) -> dict:
    """
    Boosts risk scores and consumption values proportionally.
    Houses that were already high risk get amplified more.
    """
    data = copy.deepcopy(base_data)
    boost_factor = percent / 100.0

    updated_houses = []
    for house in data["houses"]:
        h = copy.deepcopy(house)
        # Risk score boost
        base_risk = h["risk_score"]
        extra = base_risk * boost_factor * (1.2 if base_risk >= 65 else 0.6)
        h["risk_score"] = min(100, round(base_risk + extra))

        # Update risk level
        if h["risk_score"] >= 65:
            h["risk_level"] = "high"
        elif h["risk_score"] >= 35:
            h["risk_level"] = "medium"
        else:
            h["risk_level"] = "low"

        # Boost consumption
        h["average_consumption"] = round(h["average_consumption"] * (1 + boost_factor * 0.3), 4)
        h["max_consumption"] = round(h["max_consumption"] * (1 + boost_factor * 0.4), 4)

        updated_houses.append(h)

    # Re-sort by risk score
    updated_houses.sort(key=lambda x: x["risk_score"], reverse=True)

    # Re-rank priority
    for idx, h in enumerate(updated_houses):
        h["priority_rank"] = idx + 1

    # Update top 5
    top5 = [copy.deepcopy(h) for h in updated_houses[:5]]

    # Update transformer metrics
    loss_boost = data["transformer"]["loss"] * (1 + boost_factor * 0.5)
    loss_pct = round(data["transformer"]["loss_percentage"] * (1 + boost_factor * 0.5), 4)
    est_loss = round(data["transformer"]["estimated_loss_in_rupees"] * (1 + boost_factor * 0.5), 2)

    new_status = "Normal"
    if loss_pct > 0.15:
        new_status = "Critical"
    elif loss_pct > 0.08:
        new_status = "Warning"

    data["transformer"]["loss"] = round(loss_boost, 4)
    data["transformer"]["loss_percentage"] = loss_pct
    data["transformer"]["estimated_loss_in_rupees"] = est_loss
    data["transformer"]["status"] = new_status

    data["transformer_metrics"]["transformer_loss"] = round(loss_boost, 4)
    data["transformer_metrics"]["loss_ratio"] = loss_pct
    data["transformer_metrics"]["estimated_loss_in_rupees"] = est_loss
    data["transformer_metrics"]["zone_status"] = new_status

    data["insights"]["top_5_houses"] = top5
    data["insights"]["total_high_risk"] = sum(1 for h in updated_houses if h["risk_level"] == "high")
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
    data = get_base_data()
    return data


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
    Returns: updated full dataset
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
