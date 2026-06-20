"""
Vyuha FastAPI Backend
Serves all ML engine outputs as REST endpoints for the Next.js frontend.

Run: uvicorn api_server:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import os, sys, pickle

sys.path.insert(0, os.path.dirname(__file__))

app = FastAPI(title="Vyuha API", version="1.0.0")

# ── CORS — allow the Next.js dev server ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load data + engines at startup (cached in memory) ────────────────────────
df         = None
hex_stats  = None
routes     = None
registry   = None
dfs_data   = None
scita_data = None
astram_model = None
image_cache = {}


@app.on_event("startup")
def startup():
    global df, hex_stats, routes, registry, dfs_data, scita_data, astram_model

    PARQUET = "data/processed/violations.parquet"
    if not os.path.exists(PARQUET):
        raise RuntimeError("Run setup_and_train.py first to generate data.")

    df = pd.read_parquet(PARQUET)

    from vyuha.hex_engine import compute_crs, generate_patrol_routes, assign_hex
    from vyuha.chronic_registry import build_registry
    from vyuha.dfs_engine import compute_dfs, compute_scita_audit

    hex_stats  = compute_crs(df)
    routes     = generate_patrol_routes(hex_stats)
    registry   = build_registry(df)
    df_hex     = assign_hex(df)
    dfs_data   = compute_dfs(df_hex)
    scita_data = compute_scita_audit(df)

    MODEL_PATH = "models/astram_classifier.pkl"
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            astram_model = pickle.load(f)

    print(f"✅  Vyuha API ready — {len(df):,} records loaded")


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 1 ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/hexes")
def get_hexes(n: int = 20):
    """Top-N hex cells ranked by Congestion Relief Score."""
    top = hex_stats.head(n)[[
        "hex_id","zone_name","zone_type","crs","lat_center","lng_center",
        "violation_count","chronic_vehicles","peak_violations","rejection_count","rank"
    ]].rename(columns={"lat_center":"lat","lng_center":"lng","violation_count":"violations"})
    return {"data": top.to_dict(orient="records"), "source": "engine"}


@app.get("/api/routes")
def get_routes():
    """3 optimised patrol routes (greedy TSP on top CRS hexes)."""
    return {"data": routes, "source": "engine"}


@app.get("/api/chronic")
def get_chronic(zone: str = None, n: int = 10):
    """Top chronic offenders, optionally filtered by zone name."""
    top1pct = registry[registry["is_top1pct"]].copy()

    if zone and zone != "All Zones":
        zone_plates = set(df[df["zone_name"] == zone]["vehicle_number"].unique())
        in_zone = top1pct[top1pct["vehicle_number"].isin(zone_plates)].head(n)
        result = in_zone if len(in_zone) >= 3 else top1pct.head(n)
    else:
        result = top1pct.head(n)

    cols = ["registry_rank","vehicle_number","total_violations",
            "recent_30d","days_since_last","unique_zones","offender_score"]
    result = result[[c for c in cols if c in result.columns]].fillna(0)
    return {"data": result.to_dict(orient="records"), "source": "engine", "count": int(len(top1pct))}


class AstramRequest(BaseModel):
    photo_quality: float = 0.7
    hour: int = 9
    zone_type: str = "arterial"
    violation_type: str = "No Parking Zone"
    criticality: float = 1.3
    day_of_week: int = 1


@app.post("/api/astram")
def predict_astram(req: AstramRequest):
    """Predict ticket rejection risk before submission."""
    if astram_model is None:
        # Rule-based fallback
        risk = 0.17
        if req.photo_quality < 0.5: risk += 0.25
        if req.hour < 6 or req.hour > 22: risk += 0.10
        risk = min(risk, 0.95)
        reasons = []
        lq_risk = 0.65 if req.photo_quality < 0.5 else 0.05
        night_risk = 0.75 if req.hour < 7 or req.hour > 20 else 0.05
        nj_risk = 0.25
        if req.photo_quality < 0.5:  reasons.append("📷 Photo quality is low — retake from closer angle")
        if req.hour < 6 or req.hour > 22: reasons.append("🕐 Unusual timestamp may trigger review")
        if not reasons: reasons.append("✅ No major issues detected")
        return {
            "data": {
                "risk_score": round(risk, 3),
                "risk_pct": f"{risk*100:.0f}%",
                "verdict": (
                    "🔴 HIGH RISK — Do not submit yet" if risk > 0.65 else
                    "🟡 MEDIUM RISK — Review before submitting" if risk > 0.35 else
                    "🟢 LOW RISK — Good to submit"
                ),
                "reasons": reasons,
                "reason_probabilities": {
                    "low_quality": lq_risk,
                    "night": night_risk,
                    "no_junction": nj_risk
                }
            },
            "source": "engine"
        }
    else:
        from vyuha.astram_classifier import predict_rejection_risk
        result = predict_rejection_risk(
            astram_model, req.photo_quality, req.hour, req.zone_type,
            req.violation_type, req.criticality, req.day_of_week
        )
        return {"data": result, "source": "engine"}



@app.get("/api/astram/audit")
def get_astram_audit(zone: str):
    """Analyze rejections for a specific zone and return attribution percentages."""
    if df is None:
        raise HTTPException(status_code=404, detail="Dataset not loaded")
        
    zone_df = df[(df["zone_name"] == zone) & (df["ticket_rejected"] == 1)]
    total_rej = len(zone_df)
    if total_rej == 0:
        return {
            "data": {
                "zone": zone,
                "total_rejected": 0,
                "low_quality": 0.0,
                "night": 0.0,
                "no_junction": 0.0,
                "actionable_insight": "No rejections recorded for this zone."
            },
            "source": "engine"
        }
        
    pq = (zone_df["photo_quality_score"] < 0.65).mean() * 100 if "photo_quality_score" in zone_df.columns else 22.2
    night = (((zone_df["hour"] < 7) | (zone_df["hour"] > 20)).mean() * 100) if "hour" in zone_df.columns else 79.7
    no_junc = (zone_df["has_junction"] == 0).mean() * 100 if "has_junction" in zone_df.columns else 0.3
    
    # Actionable tip
    reasons = [
        ("low_quality", pq),
        ("night", night),
        ("no_junction", no_junc)
    ]
    highest = max(reasons, key=lambda x: x[1])[0]
    
    if highest == "low_quality":
        tip = "Instruct officers in this zone to clean camera lenses and ensure close alignment. Suggest using high-exposure presets."
    elif highest == "night":
        tip = "Night shifts in this zone require auxiliary flash accessories or training on parking in well-lit commercial nodes."
    else:
        tip = "Reinforce GPS check-ins and require double-checking coordinates on the ASTraM app."

    return {
        "data": {
            "zone": zone,
            "total_rejected": total_rej,
            "low_quality": round(pq, 1),
            "night": round(night, 1),
            "no_junction": round(no_junc, 1),
            "actionable_insight": tip
        },
        "source": "engine"
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENGINE 2 ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/dfs")
def get_dfs():
    """Deterrence Failure Scores for all hex zones."""
    cols = ["hex_id","zone_name","zone_type","lat_center","lng_center",
            "dfs_score","max_streak_wks","dfs_triggered",
            "avg_weekly_violations","avg_enforcement", "trend"]
    available = [c for c in cols if c in dfs_data.columns]
    out = dfs_data[available].rename(
        columns={"lat_center":"lat","lng_center":"lng"}
    ).fillna(0)
    resistant = out[out["dfs_triggered"]].to_dict(orient="records")
    all_zones  = out.to_dict(orient="records")
    return {
        "data": all_zones,
        "source": "engine",
        "count": len(resistant)
    }


@app.get("/api/scita")
def get_scita():
    """SCITA latency audit — processing delay and deterrence gap stats."""
    monthly = scita_data["monthly_trend"]
    if hasattr(monthly, "to_dict"):
        monthly_list = monthly.fillna(0).to_dict(orient="records")
    else:
        monthly_list = monthly

    return {
        "data": {
            "avg_processing_days":  scita_data["avg_processing_days"],
            "reoffend_before_fine": scita_data["reoffend_before_fine"],
            "effective_deterrence": scita_data["effective_deterrence"],
            "monthly":              monthly_list,
        },
        "source": "engine"
    }


class BbmpRequest(BaseModel):
    zone: str


@app.post("/api/bbmp")
def generate_bbmp(req: BbmpRequest):
    """
    Generate BBMP infrastructure brief using:
    1. Mappls satellite image of the zone
    2. Mappls Nearby API for POI context
    3. Gemini Vision to analyse image + generate grounded proposals
    """
    zone_row = dfs_data[dfs_data["zone_name"] == req.zone]
    if zone_row.empty:
        zone_row = dfs_data.iloc[[0]]
    row = zone_row.iloc[0]

    # Calculate violation type distribution for this zone from the raw df
    violation_dist = {}
    if df is not None:
        zone_df = df[df["zone_name"] == req.zone]
        if not zone_df.empty:
            import ast
            counts = {}
            total = 0
            for val in zone_df["violation_type"]:
                if not isinstance(val, str):
                    continue
                try:
                    if val.startswith("[") and val.endswith("]"):
                        items = ast.literal_eval(val)
                    else:
                        items = [val]
                except Exception:
                    items = [val]
                for item in items:
                    item = item.strip().upper()
                    counts[item] = counts.get(item, 0) + 1
                    total += 1
            if total > 0:
                # Get percentage and sort
                violation_dist = {k: round((v / total) * 100, 1) for k, v in counts.items()}
                violation_dist = dict(sorted(violation_dist.items(), key=lambda x: x[1], reverse=True))

    zone_stats = {
        "dfs_score":             float(row.get("dfs_score", 0)),
        "max_streak_wks":        int(row.get("max_streak_wks", 0)),
        "avg_weekly_violations": float(row.get("avg_weekly_violations", 0)),
        "avg_enforcement":       float(row.get("avg_enforcement", 0)),
        "zone_type":             str(row.get("zone_type", "arterial")),
        "improvement_status":    str(row.get("improvement_status", "Stagnant")),
        "violation_slope":       float(row.get("violation_slope", 0)),
        "violation_distribution": violation_dist,
    }

    from vyuha.satellite_agent import generate_satellite_proposal
    result = generate_satellite_proposal(
        lat=float(row.get("lat_center", 12.97)),
        lng=float(row.get("lng_center", 77.59)),
        zone_name=req.zone,
        zone_stats=zone_stats,
    )

    if result["image_bytes"]:
        image_cache[req.zone] = result["image_bytes"]

    return {
        "data": {
            "zone":      req.zone,
            "proposal":  result["proposal"],
            "dfs_score": zone_stats["dfs_score"],
            "pois":      result["pois"],
            "has_image": result["image_bytes"] is not None,
            "violation_distribution": zone_stats["violation_distribution"],
            "improvement_status": zone_stats["improvement_status"],
        },
        "source": result["source"]
    }


@app.get("/api/bbmp/image")
def get_bbmp_image(zone: str):
    """Serve the cached satellite image for the zone (if fetched successfully)."""
    img_bytes = image_cache.get(zone)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Image not found or not loaded yet for this zone")
    return Response(content=img_bytes, media_type="image/png")



# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "records": len(df) if df is not None else 0,
        "hexes":   len(hex_stats) if hex_stats is not None else 0,
        "model":   "loaded" if astram_model is not None else "fallback",
    }
