"""
Data Loader — reads and cleans the real BTP violation CSV.
Maps real columns to Vyuha's internal schema.
"""

import pandas as pd
import numpy as np
import os

DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "data", "violations.csv"
)

ZONE_TYPE_MAP = {
    "WRONG PARKING":          "arterial",
    "NO PARKING":             "arterial",
    "PARKING NEAR ROAD CROSSING": "intersection",
    "PARKING ON FOOTPATH":    "arterial",
    "PARKING NEAR BUS STOP":  "metro",
    "PARKING NEAR JUNCTION":  "intersection",
    "PARKING NEAR SIGNAL":    "intersection",
}

CRITICALITY_MAP = {
    "intersection": 1.6,
    "metro":        1.4,
    "arterial":     1.3,
    "residential":  0.9,
}


def load_real_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH, low_memory=False)

    # ── Core fields ───────────────────────────────────────────────────────────
    df = df.rename(columns={
        "id":              "violation_id",
        "latitude":        "lat",
        "longitude":       "lng",
        "vehicle_number":  "vehicle_number",
        "vehicle_type":    "vehicle_cat",
        "violation_type":  "violation_raw",
        "created_datetime":"timestamp_raw",
        "validation_status":"validation_status",
        "police_station":  "zone_name",
        "junction_name":   "junction_name",
    })

    # ── Parse timestamp ───────────────────────────────────────────────────────
    df["timestamp"] = pd.to_datetime(df["timestamp_raw"], utc=True, errors="coerce")
    df = df.dropna(subset=["timestamp", "lat", "lng"])
    df["timestamp"] = df["timestamp"].dt.tz_localize(None)  # remove tz for simplicity
    df["hour"]         = df["timestamp"].dt.hour
    df["day_of_week"]  = df["timestamp"].dt.dayofweek
    df["week_number"]  = df["timestamp"].dt.isocalendar().week.astype(int)
    df["is_peak_hour"] = ((df["hour"] >= 7) & (df["hour"] <= 10) |
                          (df["hour"] >= 17) & (df["hour"] <= 20)).astype(int)

    # ── Rejection flag ────────────────────────────────────────────────────────
    df["ticket_rejected"] = (
        df["validation_status"].str.lower().isin(["rejected", "invalid", "not approved"])
    ).astype(int)

    # ── data_sent_to_scita binary feature (real signal) ───────────────────────
    df["sent_to_scita"] = (
        df["data_sent_to_scita"].astype(str).str.upper() == "TRUE"
    ).astype(int)

    # ── Has junction info (structured observation = more reliable ticket) ─────
    df["has_junction"] = (
        df["junction_name"].astype(str).str.strip().str.lower() != "no junction"
    ).astype(int)

    # ── Violation type → zone type ────────────────────────────────────────────
    def infer_zone_type(raw):
        if isinstance(raw, str):
            for key, val in ZONE_TYPE_MAP.items():
                if key in raw.upper():
                    return val
        return "arterial"

    df["violation_type"] = df["violation_raw"].fillna("NO PARKING")
    df["zone_type"]      = df["violation_type"].apply(infer_zone_type)
    df["criticality"]    = df["zone_type"].map(CRITICALITY_MAP).fillna(1.3)

    # ── Vehicle repeat count (more violations = more experienced officer match)
    veh_counts = df["vehicle_number"].value_counts()
    df["vehicle_violation_count"] = df["vehicle_number"].map(veh_counts).fillna(1)
    threshold = veh_counts.quantile(0.99)
    df["is_chronic"] = df["vehicle_violation_count"] >= threshold

    # ── Officer-level historical rejection rate ────────────────────────────────
    known_mask = df["sent_to_scita"] == 1
    global_reject_mean = float(df.loc[known_mask, "ticket_rejected"].mean()) if known_mask.sum() > 0 else 0.167

    if "created_by_id" in df.columns and known_mask.sum() > 100:
        officer_reject = (
            df[known_mask]
            .groupby("created_by_id")["ticket_rejected"]
            .mean()
            .rename("officer_reject_rate")
            .reset_index()
        )
        df = df.merge(officer_reject, on="created_by_id", how="left")
        df["officer_reject_rate"] = df["officer_reject_rate"].fillna(global_reject_mean)
    else:
        df["officer_reject_rate"] = global_reject_mean

    # ── Zone-level rejection rate ─────────────────────────────────────────────
    # Recompute known_mask after potential merge (index may have changed)
    known_mask = df["sent_to_scita"] == 1
    if known_mask.sum() > 100:
        zone_reject = (
            df[known_mask]
            .groupby("zone_name")["ticket_rejected"]
            .mean()
            .rename("zone_reject_rate")
            .reset_index()
        )
        df = df.merge(zone_reject, on="zone_name", how="left")
        df["zone_reject_rate"] = df["zone_reject_rate"].fillna(global_reject_mean)
    else:
        df["zone_reject_rate"] = 0.167

    # ── Photo quality proxy ───────────────────────────────────────────────────
    # Tickets sent to SCITA had better documentation by definition
    rng = np.random.default_rng(42)
    df["photo_quality_score"] = np.where(
        df["sent_to_scita"] == 1,
        rng.uniform(0.55, 1.0, len(df)),
        rng.uniform(0.15, 0.6, len(df)),
    )

    # ── Processing days ───────────────────────────────────────────────────────
    try:
        df["closed_dt"] = pd.to_datetime(
            df["closed_datetime"], utc=True, errors="coerce"
        ).dt.tz_localize(None)
        df["processing_days"] = (df["closed_dt"] - df["timestamp"]).dt.days.clip(1, 90)
        df["processing_days"] = df["processing_days"].fillna(19.5)
    except Exception:
        df["processing_days"] = np.random.normal(19.5, 6, len(df)).clip(3, 60)

    # ── Enforcement visits proxy ──────────────────────────────────────────────
    zone_wk = df.groupby(["zone_name", "week_number"])["violation_id"].transform("count")
    df["enforcement_visits"] = (zone_wk / 8).clip(1, 15).astype(int)

    # ── Final cleanup ─────────────────────────────────────────────────────────
    keep_cols = [
        "violation_id", "timestamp", "lat", "lng", "zone_name", "zone_type",
        "criticality", "vehicle_number", "is_chronic", "violation_type",
        "photo_quality_score", "ticket_rejected", "processing_days",
        "enforcement_visits", "week_number", "hour", "is_peak_hour", "day_of_week",
        "sent_to_scita", "has_junction", "vehicle_violation_count",
        "officer_reject_rate", "zone_reject_rate",
    ]
    df = df[[c for c in keep_cols if c in df.columns]].copy()
    df["violation_id"] = df["violation_id"].astype(str)
    df = df.reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = load_real_data()
    out = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "violations.parquet")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    df.to_parquet(out, index=False)
    print(f"✅  Loaded {len(df):,} real BTP records → {out}")
    print(f"   Date range  : {df.timestamp.min().date()} → {df.timestamp.max().date()}")
    print(f"   Rejection % : {df.ticket_rejected.mean():.1%}")
    print(f"   Chronic veh : {df.is_chronic.sum():,} records from top-1% vehicles")
    print(f"   Zones       : {df.zone_name.nunique()} unique police station zones")
