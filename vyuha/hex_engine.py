"""
Hex Engine — H3 spatial binning and Congestion Relief Score computation.
"""

import h3
import pandas as pd
import numpy as np
from typing import List, Dict, Tuple

# H3 v3 vs v4 compatibility
_latlng_to_cell = getattr(h3, "latlng_to_cell", None) or h3.geo_to_h3
_cell_to_boundary = getattr(h3, "cell_to_boundary", None) or h3.h3_to_geo_boundary


H3_RESOLUTION = 8          # ~500m hex cells

def _time_weight(hour: int) -> float:
    if 7 <= hour <= 10 or 17 <= hour <= 20:
        return 2.0
    if 10 < hour < 17:
        return 1.2
    return 0.5

ZONE_MULTIPLIERS = {
    "intersection": 1.7,
    "metro":        1.4,
    "arterial":     1.4,
    "residential":  0.8,
}


def assign_hex(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["hex_id"] = df.apply(
        lambda r: _latlng_to_cell(r["lat"], r["lng"], H3_RESOLUTION), axis=1
    )
    return df


def compute_crs(df: pd.DataFrame) -> pd.DataFrame:
    df = assign_hex(df)
    df["tw"]            = df["hour"].apply(_time_weight)
    df["zm"]            = df["zone_type"].map(ZONE_MULTIPLIERS).fillna(1.0)
    df["score_contrib"] = df["tw"] * df["zm"]

    hex_stats = (
        df.groupby("hex_id")
        .agg(
            violation_count  = ("violation_id",     "count"),
            raw_crs          = ("score_contrib",    "sum"),
            zone_name        = ("zone_name",        lambda x: x.mode()[0]),
            zone_type        = ("zone_type",        lambda x: x.mode()[0]),
            lat_center       = ("lat",              "mean"),
            lng_center       = ("lng",              "mean"),
            peak_violations  = ("is_peak_hour",     "sum"),
            rejection_count  = ("ticket_rejected",  "sum"),
            chronic_vehicles = ("is_chronic",       "sum"),
        )
        .reset_index()
    )

    mn, mx = hex_stats["raw_crs"].min(), hex_stats["raw_crs"].max()
    hex_stats["crs"] = ((hex_stats["raw_crs"] - mn) / (mx - mn + 1e-9) * 100).round(1)
    hex_stats = hex_stats.sort_values("crs", ascending=False).reset_index(drop=True)
    hex_stats["rank"] = hex_stats.index + 1
    return hex_stats


def get_hex_boundary(hex_id: str) -> List[Tuple[float, float]]:
    boundary = _cell_to_boundary(hex_id)
    return [(lat, lng) for lat, lng in boundary]


def get_top_hexes(hex_stats: pd.DataFrame, n: int = 20) -> pd.DataFrame:
    return hex_stats.head(n).copy()


def generate_patrol_routes(
    hex_stats: pd.DataFrame,
    n_routes: int = 3,
    hexes_per_route: int = 5,
    depot_lat: float = 12.9716,
    depot_lng: float = 77.5946,
) -> List[Dict]:
    top = hex_stats.head(n_routes * hexes_per_route).copy()
    routes = []
    colors = ["#ef4444", "#f59e0b", "#10b981"]
    labels = ["Route A — Maximum Impact", "Route B — North Corridor", "Route C — South Cluster"]

    for i in range(n_routes):
        batch   = top.iloc[i * hexes_per_route: (i + 1) * hexes_per_route].copy()
        ordered = _greedy_tsp(depot_lat, depot_lng, batch)
        routes.append({
            "id":          i + 1,
            "route_id":    i + 1,
            "color":       colors[i],
            "label":       labels[i],
            "waypoints":   ordered,
            "total_crs":   float(round(batch["crs"].sum(), 1)),
            "crs":         float(round(batch["crs"].sum(), 1)),
            "est_duration":f"{len(ordered) * 12}–{len(ordered) * 18} min",
            "time":        f"{len(ordered) * 12}–{len(ordered) * 18} min",
        })
    return routes


def _haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lng2 - lng1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlng/2)**2
    return 2 * R * np.arcsin(np.sqrt(a))


def _greedy_tsp(depot_lat, depot_lng, batch: pd.DataFrame) -> List[Dict]:
    remaining = batch.copy()
    cur_lat, cur_lng = depot_lat, depot_lng
    ordered = []
    while not remaining.empty:
        remaining = remaining.copy()
        remaining["dist"] = remaining.apply(
            lambda r: _haversine(cur_lat, cur_lng, r["lat_center"], r["lng_center"]), axis=1
        )
        nearest = remaining.loc[remaining["dist"].idxmin()]
        ordered.append({
            "hex_id":    nearest["hex_id"],
            "zone_name": nearest["zone_name"],
            "zone":      nearest["zone_name"],
            "lat":       float(nearest["lat_center"]),
            "lng":       float(nearest["lng_center"]),
            "crs":       float(nearest["crs"]),
            "violations":int(nearest["violation_count"]),
        })
        cur_lat, cur_lng = nearest["lat_center"], nearest["lng_center"]
        remaining = remaining.drop(nearest.name)
    return ordered
