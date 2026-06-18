"""
One-shot setup script.
Run this ONCE: python setup_and_train.py
It will:
  1. Generate synthetic violation data
  2. Train the ASTraM LightGBM classifier
  3. Verify both Engine outputs print correctly
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))

print("=" * 60)
print("  VYUHA — Setup & Training Pipeline")
print("=" * 60)

# Step 1: Generate data
print("\n[1/3] Generating synthetic violation data...")
# pyrefly: ignore [missing-import]
from data.synthetic.generate import generate_violations
os.makedirs("data/processed", exist_ok=True)
df = generate_violations(60_000)
df.to_parquet("data/processed/violations.parquet", index=False)
print(f"      ✅  {len(df):,} records → data/processed/violations.parquet")

# Step 2: Train ASTraM
print("\n[2/3] Training ASTraM rejection classifier...")
# pyrefly: ignore [missing-import]
from vyuha.astram_classifier import train_classifier
model = train_classifier(df)
print("      ✅  Model saved → models/astram_classifier.pkl")

# Step 3: Verify engines
print("\n[3/3] Verifying engines...")
# pyrefly: ignore [missing-import]
from vyuha.hex_engine import compute_crs, generate_patrol_routes, assign_hex
# pyrefly: ignore [missing-import]
from vyuha.chronic_registry import build_registry
# pyrefly: ignore [missing-import]
from vyuha.dfs_engine import compute_dfs, compute_scita_audit

hex_stats = compute_crs(df)
print(f"      Hex Engine: {len(hex_stats)} hexes scored. Top zone: {hex_stats.iloc[0]['zone_name']} (CRS={hex_stats.iloc[0]['crs']})")

routes = generate_patrol_routes(hex_stats)
print(f"      Patrol Router: {len(routes)} routes generated")

registry = build_registry(df)
top1pct  = registry[registry["is_top1pct"]]
print(f"      Chronic Registry: {len(top1pct)} top-1% offenders isolated")

df_hex = assign_hex(df)
dfs    = compute_dfs(df_hex)
resistant = dfs[dfs["dfs_triggered"]]
print(f"      DFS Engine: {len(resistant)} enforcement-resistant zones detected")

scita = compute_scita_audit(df)
print(f"      SCITA Audit: {scita['avg_processing_days']} day avg · {scita['reoffend_before_fine']}% re-offend before fine")

print("\n" + "=" * 60)
print("  ✅ ALL SYSTEMS READY — run the dashboard:")
print("     streamlit run app/main.py")
print("=" * 60)
