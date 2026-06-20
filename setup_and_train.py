"""
One-shot setup: loads real BTP data, trains ASTraM, verifies all engines.
Run: python setup_and_train.py
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))

print("=" * 60)
print("  VYUHA — Setup & Training Pipeline")
print("=" * 60)

# ── Step 1: Load data ─────────────────────────────────────────────────────────
print("\n[1/3] Loading BTP violation data...")
os.makedirs("data/processed", exist_ok=True)
df = None

try:
    from vyuha.data_pipeline import load_real_data
    df = load_real_data()
    df.to_parquet("data/processed/violations.parquet", index=False)
    print(f"      ✅  {len(df):,} real records → data/processed/violations.parquet")
    print(f"      Date range : {df.timestamp.min().date()} → {df.timestamp.max().date()}")
    print(f"      Rejection %: {df.ticket_rejected.mean():.1%}")
    print(f"      Zones      : {df.zone_name.nunique()} unique zones")
except Exception as e:
    print(f"      ⚠️  Real data failed: {e}")
    print("      Falling back to synthetic data...")
    try:
        import importlib.util, pathlib
        spec = importlib.util.spec_from_file_location(
            "generate",
            pathlib.Path(__file__).parent / "data" / "synthetic" / "generate.py"
        )
        gen = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(gen)
        df = gen.generate_violations(60_000)
        df.to_parquet("data/processed/violations.parquet", index=False)
        print(f"      ✅  {len(df):,} synthetic records generated")
    except Exception as e2:
        print(f"      ❌  Synthetic data also failed: {e2}")
        sys.exit(1)

# ── Step 2: Train ASTraM ──────────────────────────────────────────────────────
print("\n[2/3] Training ASTraM rejection classifier...")
try:
    from vyuha.astram_classifier import train_classifier
    os.makedirs("models", exist_ok=True)
    model = train_classifier(df)
    print("      ✅  Model saved → models/astram_classifier.pkl")
except Exception as e:
    print(f"      ⚠️  ASTraM training failed: {e}")
    print("      Dashboard will use rule-based fallback for ASTraM")

# ── Step 3: Verify engines ────────────────────────────────────────────────────
print("\n[3/3] Verifying engines...")

try:
    from vyuha.hex_engine import compute_crs, generate_patrol_routes, assign_hex
    hex_stats = compute_crs(df)
    routes    = generate_patrol_routes(hex_stats)
    print(f"      Hex Engine      : {len(hex_stats)} hexes · Top → '{hex_stats.iloc[0]['zone_name']}' (CRS={hex_stats.iloc[0]['crs']})")
    print(f"      Patrol Router   : {len(routes)} routes generated")
except Exception as e:
    print(f"      ❌  Hex engine error: {e}")

try:
    from vyuha.chronic_registry import build_registry
    registry = build_registry(df)
    top1pct  = registry[registry["is_top1pct"]]
    print(f"      Chronic Registry: {len(top1pct)} top-1% offenders isolated out of {len(registry):,} vehicles")
except Exception as e:
    print(f"      ❌  Chronic registry error: {e}")

try:
    from vyuha.hex_engine import assign_hex
    from vyuha.dfs_engine import compute_dfs, compute_scita_audit
    df_hex    = assign_hex(df)
    dfs       = compute_dfs(df_hex)
    resistant = dfs[dfs["dfs_triggered"]]
    scita     = compute_scita_audit(df)
    print(f"      DFS Engine      : {len(resistant)} enforcement-resistant zones")
    print(f"      SCITA Audit     : {scita['avg_processing_days']}d avg · {scita['reoffend_before_fine']}% re-offend before fine")
except Exception as e:
    print(f"      ❌  DFS engine error: {e}")

print("\n" + "=" * 60)
print("  ✅ SETUP COMPLETE — launch the dashboard:")
print("     streamlit run app/main.py")
print("=" * 60)
