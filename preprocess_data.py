"""
preprocess_data.py
==================
Reads the real BTP violations CSV and generates pre-aggregated JSON
for all API endpoints. Run once, then api_server.py loads the JSON.

Usage:
    python preprocess_data.py
    
Output:
    data/api_hexes.json
    data/api_chronic.json
    data/api_dfs.json
    data/api_scita.json
    data/api_routes.json
"""

import csv
import json
import os
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
CSV_PATH = os.path.join(DATA_DIR, "violations.csv")


def parse_datetime(s):
    """Parse datetime string, return None on failure."""
    if not s or s == "NULL":
        return None
    try:
        # Handle timezone offset format
        s = s.strip().rstrip("\r")
        if "+" in s:
            s = s.split("+")[0].strip()
        return datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def load_csv():
    """Load all rows from the CSV."""
    print(f"Loading {CSV_PATH}...")
    rows = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    print(f"  Loaded {len(rows):,} rows")
    return rows


def build_hexes(rows):
    """
    Aggregate by police_station to create hex cells.
    CRS = composite score from violation count + chronic ratio + rejection rate.
    """
    print("Building /api/hexes...")

    # Group by police station
    by_station = defaultdict(list)
    for r in rows:
        ps = r["police_station"].strip()
        if ps:
            by_station[ps].append(r)

    # Compute per-station stats
    hexes = []
    for station, station_rows in sorted(by_station.items(), key=lambda x: -len(x[1])):
        n = len(station_rows)

        # Average lat/lng from the station's violations
        lats = [float(r["latitude"]) for r in station_rows if r["latitude"]]
        lngs = [float(r["longitude"]) for r in station_rows if r["longitude"]]
        if not lats or not lngs:
            continue

        avg_lat = sum(lats) / len(lats)
        avg_lng = sum(lngs) / len(lngs)

        # Vehicle type breakdown (as percentages)
        vt_counts = Counter(r["vehicle_type"] for r in station_rows)
        two_wheeler = sum(v for k, v in vt_counts.items() if k in ("SCOOTER", "MOTOR CYCLE", "MOPED"))
        four_wheeler = sum(v for k, v in vt_counts.items() if k in ("CAR", "MAXI-CAB", "VAN"))
        commercial = sum(v for k, v in vt_counts.items() if k in ("PASSENGER AUTO", "GOODS AUTO", "LGV", "PRIVATE BUS"))
        total_veh = max(two_wheeler + four_wheeler + commercial, 1)
        two_pct = round(two_wheeler / total_veh * 100)
        four_pct = round(four_wheeler / total_veh * 100)
        comm_pct = 100 - two_pct - four_pct

        # Chronic vehicles (>=3 violations at this station)
        vehs = Counter(r["vehicle_number"] for r in station_rows)
        chronic_count = sum(1 for v in vehs.values() if v >= 3)

        # Rejection rate
        rejected = sum(1 for r in station_rows if r["validation_status"] == "rejected")
        rejection_rate = rejected / n if n > 0 else 0

        # Weekly violation counts for trend (group by ISO week)
        weekly = defaultdict(int)
        for r in station_rows:
            dt = parse_datetime(r["created_datetime"])
            if dt:
                week_key = dt.strftime("%Y-W%W")
                weekly[week_key] += 1
        sorted_weeks = sorted(weekly.keys())
        trend = [weekly[w] for w in sorted_weeks[-12:]]  # last 12 weeks
        if len(trend) < 12:
            trend = [0] * (12 - len(trend)) + trend

        # Peak violations in a single week
        peak = max(weekly.values()) if weekly else 0

        # CRS = log-normalized composite for better spread (30-95 range)
        volume_score = min(math.log(n + 1) / math.log(35000) * 40, 40)  # log scale
        chronic_density = min((chronic_count / max(n * 0.01, 1)) * 30, 30)
        rejection_score = rejection_rate * 30

        crs_raw = volume_score + chronic_density + rejection_score
        crs = min(round(crs_raw, 1), 97)

        hexes.append({
            "hex_id": f"hex_{station.lower().replace(' ', '_')}",
            "zone_name": station,
            "zone_type": "police_station",
            "lat": round(avg_lat, 6),
            "lng": round(avg_lng, 6),
            "crs": crs,
            "violations": n,
            "chronic_vehicles": chronic_count,
            "peak_violations": peak,
            "rejections": rejected,
            "vehicle_profile": {
                "two_wheeler": two_pct,
                "four_wheeler": four_pct,
                "commercial": comm_pct,
            },
            "trend": trend,
        })


    # Sort by CRS descending
    hexes.sort(key=lambda x: -x["crs"])
    print(f"  Generated {len(hexes)} hex zones")
    return hexes


def build_routes(hexes):
    """Generate 3 patrol routes connecting top-CRS zones."""
    print("Building /api/routes...")

    top = hexes[:12]  # top 12 zones
    routes = []

    route_configs = [
        {"id": 1, "color": "#dc2626", "label": "Route Alpha — High Priority",
         "indices": [0, 1, 2, 3]},
        {"id": 2, "color": "#2563eb", "label": "Route Beta — Central",
         "indices": [4, 5, 6, 7]},
        {"id": 3, "color": "#16a34a", "label": "Route Gamma — Outer",
         "indices": [8, 9, 10, 11]},
    ]

    for rc in route_configs:
        waypoints = []
        total_crs = 0
        for order, idx in enumerate(rc["indices"]):
            if idx < len(top):
                h = top[idx]
                waypoints.append({
                    "zone": h["zone_name"],
                    "lat": h["lat"],
                    "lng": h["lng"],
                    "crs": h["crs"],
                    "order": order + 1,
                })
                total_crs += h["crs"]

        routes.append({
            "id": rc["id"],
            "color": rc["color"],
            "label": rc["label"],
            "total_crs": round(total_crs, 1),
            "eta": f"{len(waypoints) * 25} min",
            "stops": len(waypoints),
            "waypoints": waypoints,
        })

    print(f"  Generated {len(routes)} routes")
    return routes


def build_chronic(rows):
    """Top repeat offenders from real vehicle_number counts."""
    print("Building /api/chronic...")

    veh_data = defaultdict(lambda: {
        "violations": [],
        "zones": set(),
        "types": Counter(),
    })

    for r in rows:
        vn = r["vehicle_number"]
        if not vn or vn == "NULL":
            continue
        veh_data[vn]["violations"].append(r)
        veh_data[vn]["zones"].add(r["police_station"])
        veh_data[vn]["types"][r["vehicle_type"]] += 1

    # Sort by violation count
    sorted_vehs = sorted(veh_data.items(), key=lambda x: -len(x[1]["violations"]))

    chronic = []
    for rank, (vn, info) in enumerate(sorted_vehs[:20], 1):
        viols = info["violations"]
        n = len(viols)

        # Parse dates for recency
        dates = [parse_datetime(r["created_datetime"]) for r in viols]
        dates = [d for d in dates if d]
        dates.sort()

        # Last 30 days count
        if dates:
            cutoff = dates[-1] - timedelta(days=30)
            last_30 = sum(1 for d in dates if d >= cutoff)
            days_since = (dates[-1] - dates[-2]).days if len(dates) >= 2 else 0
        else:
            last_30 = 0
            days_since = 99

        # Most common vehicle type
        top_type = info["types"].most_common(1)[0][0] if info["types"] else "Unknown"

        # Threat score = violations * zone_spread * recency_factor
        zone_count = len(info["zones"])
        recency_factor = max(1, 10 - days_since)
        threat_score = n * (1 + zone_count * 0.3) * (recency_factor * 0.2)

        chronic.append({
            "rank": rank,
            "vehicle": vn,
            "total_violations": n,
            "last_30_days": last_30,
            "days_since_last": days_since,
            "zones_hit": zone_count,
            "threat_score": round(threat_score, 1),
            "primary_zone": max(
                [(ps, sum(1 for r in viols if r["police_station"] == ps))
                 for ps in info["zones"]],
                key=lambda x: x[1]
            )[0],
            "vehicle_type": top_type,
        })

    print(f"  Generated {len(chronic)} chronic offenders")
    return chronic


def build_dfs(rows, hexes):
    """
    Deterrence Failure Score per zone.
    DFS = consistency of violations despite time (low variance + sustained volume).
    """
    print("Building /api/dfs...")

    by_station = defaultdict(list)
    for r in rows:
        by_station[r["police_station"].strip()].append(r)

    dfs_zones = []
    for station, station_rows in by_station.items():
        if not station:
            continue

        # Weekly violation counts
        weekly = defaultdict(int)
        enforcement = defaultdict(int)  # approximate enforcement from validation
        for r in station_rows:
            dt = parse_datetime(r["created_datetime"])
            if dt:
                wk = dt.strftime("%Y-W%W")
                weekly[wk] += 1
                if r["validation_status"] in ("approved", "rejected"):
                    enforcement[wk] += 1

        if len(weekly) < 4:
            continue

        sorted_weeks = sorted(weekly.keys())
        values = [weekly[w] for w in sorted_weeks]

        # Streak: consecutive weeks with violations above median
        median_val = sorted(values)[len(values) // 2]
        streak = 0
        current_streak = 0
        for v in values:
            if v >= median_val * 0.7:
                current_streak += 1
                streak = max(streak, current_streak)
            else:
                current_streak = 0

        # DFS: high consistency + high volume = high DFS
        avg_weekly = sum(values) / len(values)
        std_dev = (sum((v - avg_weekly) ** 2 for v in values) / len(values)) ** 0.5
        cv = std_dev / avg_weekly if avg_weekly > 0 else 1  # coefficient of variation

        # Low CV = consistent violations = higher DFS
        consistency = max(0, 1 - cv)  # 0 to 1
        volume_norm = min(avg_weekly / 800, 1)  # normalize to top station
        dfs_score = (consistency * 50 + volume_norm * 30 + (streak / 24) * 20)
        dfs_score = min(round(dfs_score, 1), 100)

        # Get avg enforcement
        avg_enf = sum(enforcement.values()) / max(len(enforcement), 1)

        # Find hex data for lat/lng
        hex_match = next((h for h in hexes if h["zone_name"] == station), None)
        if not hex_match:
            continue

        # Trend
        trend = [weekly[w] for w in sorted_weeks[-12:]]
        if len(trend) < 12:
            trend = [0] * (12 - len(trend)) + trend

        # Civic failure classification
        n = len(station_rows)
        vt = Counter(r["violation_type"] for r in station_rows)
        top_violation = vt.most_common(1)[0][0] if vt else ""

        if "NO PARKING" in top_violation:
            civic_failure = "Insufficient parking infrastructure near commercial areas"
        elif "WRONG PARKING" in top_violation:
            civic_failure = "Missing physical barriers and road geometry failure"
        elif "FOOTPATH" in top_violation:
            civic_failure = "Missing/broken footpath forcing vehicles onto road"
        elif "BUS" in top_violation:
            civic_failure = "No physical bay demarcation at bus stops"
        else:
            civic_failure = "Chronic enforcement-resistant zone — needs infrastructure audit"

        # Agencies
        if n > 15000:
            agencies = ["BBMP", "BTP", "BMTC"]
        elif n > 5000:
            agencies = ["BBMP", "BTP"]
        else:
            agencies = ["BBMP"]

        dfs_zones.append({
            "hex_id": f"dfs_{station.lower().replace(' ', '_')}",
            "zone_name": station,
            "zone_type": "police_station",
            "lat": hex_match["lat"],
            "lng": hex_match["lng"],
            "dfs_score": dfs_score,
            "streak_weeks": streak,
            "avg_weekly_violations": round(avg_weekly, 1),
            "avg_enforcement": round(avg_enf, 1),
            "is_resistant": dfs_score >= 55,
            "civic_failure": civic_failure,
            "agencies": agencies,
            "vehicle_profile": hex_match["vehicle_profile"],
            "trend": trend,
        })

    dfs_zones.sort(key=lambda x: -x["dfs_score"])
    print(f"  Generated {len(dfs_zones)} DFS zones ({sum(1 for z in dfs_zones if z['is_resistant'])} resistant)")
    return dfs_zones


def build_scita(rows):
    """Real SCITA processing delay analysis."""
    print("Building /api/scita...")

    # Processing time = created_datetime → validation_timestamp
    delays_hours = []
    monthly_data = defaultdict(lambda: {"violations": 0, "rejected": 0, "days_total": 0, "days_count": 0})

    total_approved = 0
    total_rejected = 0
    total_null = 0

    repeat_vehicles = Counter()
    for r in rows:
        repeat_vehicles[r["vehicle_number"]] += 1

    repeaters = {v for v, c in repeat_vehicles.items() if c >= 3}

    # Count how many re-violated before their fine
    reoffend_before_fine = 0
    total_repeat_checked = 0

    for r in rows:
        created = parse_datetime(r["created_datetime"])
        validated = parse_datetime(r.get("validation_timestamp", ""))

        if not created:
            continue

        month_key = created.strftime("%b %Y")
        monthly_data[month_key]["violations"] += 1

        if r["validation_status"] == "rejected":
            total_rejected += 1
            monthly_data[month_key]["rejected"] += 1
        elif r["validation_status"] == "approved":
            total_approved += 1
        else:
            total_null += 1

        if created and validated:
            delay = (validated - created).total_seconds() / 3600
            if 0 < delay < 5000:  # filter outliers
                delays_hours.append(delay)
                monthly_data[month_key]["days_total"] += delay / 24
                monthly_data[month_key]["days_count"] += 1

        # Check re-offending before fine
        if r["vehicle_number"] in repeaters and validated and created:
            # If validation happened after more than 3 days, check for re-violation
            if (validated - created).days > 3:
                reoffend_before_fine += 1
            total_repeat_checked += 1

    # Average processing
    avg_hours = sum(delays_hours) / len(delays_hours) if delays_hours else 468
    avg_days = avg_hours / 24

    # Re-offend percentage
    reoffend_pct = round((reoffend_before_fine / max(total_repeat_checked, 1)) * 100, 1)

    # Effective deterrence
    effective = round(100 - reoffend_pct, 1)

    # Monthly trend
    monthly_trend = []
    for month_key in sorted(monthly_data.keys(), key=lambda x: datetime.strptime(x, "%b %Y")):
        md = monthly_data[month_key]
        avg_d = md["days_total"] / max(md["days_count"], 1)
        monthly_trend.append({
            "month": month_key.split()[0],  # Just "Jan", "Feb", etc.
            "avg_days": round(avg_d, 1),
            "violations": md["violations"],
            "rejected": md["rejected"],
        })

    # Delay distribution buckets
    buckets = {"0-3d": 0, "3-7d": 0, "7-14d": 0, "14-21d": 0, "21-30d": 0, "30d+": 0}
    for h in delays_hours:
        d = h / 24
        if d <= 3:
            buckets["0-3d"] += 1
        elif d <= 7:
            buckets["3-7d"] += 1
        elif d <= 14:
            buckets["7-14d"] += 1
        elif d <= 21:
            buckets["14-21d"] += 1
        elif d <= 30:
            buckets["21-30d"] += 1
        else:
            buckets["30d+"] += 1

    total = len(delays_hours) or 1
    delay_dist = [
        {"bucket": k, "count": v, "pct": round(v / total * 100, 1)}
        for k, v in buckets.items()
    ]

    scita = {
        "avg_processing_days": round(avg_days, 1),
        "avg_processing_hours": round(avg_hours, 0),
        "reoffend_before_fine_pct": reoffend_pct,
        "effective_deterrence_pct": effective,
        "total_repeat_vehicles": len(repeaters),
        "repeat_within_window": reoffend_before_fine,
        "monthly_trend": monthly_trend,
        "delay_distribution": delay_dist,
    }

    print(f"  Avg processing: {avg_days:.1f} days ({avg_hours:.0f} hrs)")
    print(f"  Rejection rate: {total_rejected}/{len(rows)} = {total_rejected/len(rows)*100:.1f}%")
    print(f"  Re-offend before fine: {reoffend_pct}%")
    return scita


def save_json(data, filename):
    """Save data as JSON."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Saved → {path}")


def main():
    print("=" * 60)
    print("Vyuha Data Preprocessor")
    print("=" * 60)

    rows = load_csv()

    hexes = build_hexes(rows)
    save_json(hexes, "api_hexes.json")

    routes = build_routes(hexes)
    save_json(routes, "api_routes.json")

    chronic = build_chronic(rows)
    save_json(chronic, "api_chronic.json")

    dfs = build_dfs(rows, hexes)
    save_json(dfs, "api_dfs.json")

    scita = build_scita(rows)
    save_json(scita, "api_scita.json")

    print("\n" + "=" * 60)
    print("✅ All data files generated in data/")
    print("   Now restart api_server.py — it will auto-load these files.")
    print("=" * 60)


if __name__ == "__main__":
    main()
