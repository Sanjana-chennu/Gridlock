"""Vyuha package init — lazy imports to avoid hard crash on missing libomp."""

__all__ = [
    "compute_crs", "generate_patrol_routes", "assign_hex",
    "build_registry", "get_tow_on_sight_list",
    "train_classifier", "load_classifier", "predict_rejection_risk",
    "compute_dfs", "compute_scita_audit",
]

def __getattr__(name):
    if name in ("compute_crs", "generate_patrol_routes", "assign_hex"):
        from vyuha.hex_engine import compute_crs, generate_patrol_routes, assign_hex
        return locals()[name]
    if name in ("build_registry", "get_tow_on_sight_list"):
        from vyuha.chronic_registry import build_registry, get_tow_on_sight_list
        return locals()[name]
    if name in ("train_classifier", "load_classifier", "predict_rejection_risk"):
        from vyuha.astram_classifier import train_classifier, load_classifier, predict_rejection_risk
        return locals()[name]
    if name in ("compute_dfs", "compute_scita_audit"):
        from vyuha.dfs_engine import compute_dfs, compute_scita_audit
        return locals()[name]
    raise AttributeError(f"module 'vyuha' has no attribute {name!r}")
