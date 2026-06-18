"""Vyuha package init — exposes core engines."""
# pyrefly: ignore [missing-import]
from vyuha.hex_engine import compute_crs, generate_patrol_routes, assign_hex
# pyrefly: ignore [missing-import]
from vyuha.chronic_registry import build_registry, get_tow_on_sight_list
# pyrefly: ignore [missing-import]
from vyuha.astram_classifier import train_classifier, load_classifier, predict_rejection_risk
# pyrefly: ignore [missing-import]
from vyuha.dfs_engine import compute_dfs, compute_scita_audit

__all__ = [
    "compute_crs", "generate_patrol_routes", "assign_hex",
    "build_registry", "get_tow_on_sight_list",
    "train_classifier", "load_classifier", "predict_rejection_risk",
    "compute_dfs", "compute_scita_audit",
]
