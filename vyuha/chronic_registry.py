"""
Chronic Offender Registry
Isolates the worst 1% of repeat violators and surfaces them per hex zone.
"""

import pandas as pd
import numpy as np


def build_registry(df: pd.DataFrame) -> pd.DataFrame:
    now = df["timestamp"].max()

    agg = (
        df.groupby("vehicle_number")
        .agg(
            total_violations  = ("violation_id",      "count"),
            last_violation    = ("timestamp",         "max"),
            first_violation   = ("timestamp",         "min"),
            unique_zones      = ("zone_name",         "nunique"),
            peak_violations   = ("is_peak_hour",      "sum"),
            avg_criticality   = ("criticality",       "mean"),
            is_chronic        = ("is_chronic",        "first"),
        )
        .reset_index()
    )

    recent_30 = (
        df[df["timestamp"] >= now - pd.Timedelta(days=30)]
        .groupby("vehicle_number")["violation_id"]
        .count().rename("recent_30d")
    )
    recent_90 = (
        df[df["timestamp"] >= now - pd.Timedelta(days=90)]
        .groupby("vehicle_number")["violation_id"]
        .count().rename("recent_90d")
    )
    agg = agg.merge(recent_30, on="vehicle_number", how="left").fillna({"recent_30d": 0})
    agg = agg.merge(recent_90, on="vehicle_number", how="left").fillna({"recent_90d": 0})

    agg["offender_score"] = (
        agg["total_violations"] * 1.0 +
        agg["recent_30d"]       * 3.0 +
        agg["recent_90d"]       * 2.0 +
        agg["unique_zones"]     * 0.5 +
        agg["avg_criticality"]  * 5.0
    ).round(2)

    agg["days_since_last"] = (now - agg["last_violation"]).dt.days
    agg = agg.sort_values("offender_score", ascending=False).reset_index(drop=True)
    agg["registry_rank"] = agg.index + 1

    threshold = max(1, int(len(agg) * 0.01))
    agg["is_top1pct"] = agg["registry_rank"] <= threshold

    return agg


def get_tow_on_sight_list(
    registry: pd.DataFrame,
    df: pd.DataFrame,
    hex_id: str,
    n: int = 5,
) -> pd.DataFrame:
    top1pct = registry[registry["is_top1pct"]].copy()
    if "hex_id" in df.columns:
        zone_rows  = df[df["hex_id"] == hex_id]
        zone_plates = set(zone_rows["vehicle_number"].unique())
        in_zone = top1pct[top1pct["vehicle_number"].isin(zone_plates)].head(n)
        if len(in_zone) >= n:
            return _format_tow_list(in_zone)
    return _format_tow_list(top1pct.head(n))


def _format_tow_list(df: pd.DataFrame) -> pd.DataFrame:
    cols = ["registry_rank","vehicle_number","total_violations",
            "recent_30d","days_since_last","unique_zones","offender_score"]
    return df[[c for c in cols if c in df.columns]].copy()
