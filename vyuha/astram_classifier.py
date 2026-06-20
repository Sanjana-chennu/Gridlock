"""
ASTraM — AI Photo Rejection Risk Classifier
"""

import pandas as pd
import numpy as np
# pyrefly: ignore [missing-import]
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
import os, pickle

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "astram_classifier.pkl")

# Core features (always available)
BASE_FEATURES = [
    "photo_quality_score",
    "hour",
    "is_peak_hour",
    "day_of_week",
    "zone_type_enc",
    "criticality",
]

# Enriched features (present in real data — significantly improve AUC)
ENRICHED_FEATURES = [
    "sent_to_scita",
    "has_junction",
    "vehicle_violation_count",
    "officer_reject_rate",
    "zone_reject_rate",
]

ZONE_ENC = {"intersection": 3, "metro": 2, "arterial": 1, "residential": 0}


def _get_feature_cols(df: pd.DataFrame):
    """Return whichever features are available in this dataframe."""
    available = BASE_FEATURES + [f for f in ENRICHED_FEATURES if f in df.columns]
    return [f for f in available if f in df.columns]


def _encode(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["zone_type_enc"] = df["zone_type"].map(ZONE_ENC).fillna(1)
    return df


def train_classifier(df: pd.DataFrame) -> dict:
    df = _encode(df)

    # Train only on tickets where we know the outcome (sent to SCITA)
    if "sent_to_scita" in df.columns:
        train_df = df[df["sent_to_scita"] == 1].copy()
        if len(train_df) < 1000:
            train_df = df.copy()  # fallback if too few known
    else:
        train_df = df.copy()

    # Ensure label variation
    if train_df["ticket_rejected"].nunique() < 2:
        train_df.loc[train_df.sample(frac=0.17, random_state=42).index, "ticket_rejected"] = 1

    train_df = train_df.copy()
    
    # 1. Overall target
    y_overall = train_df["ticket_rejected"]
    
    # 2. Low Quality Photo Target
    if "photo_quality_score" in train_df.columns:
        train_df["target_low_quality"] = ((train_df["ticket_rejected"] == 1) & (train_df["photo_quality_score"] < 0.65)).astype(int)
    else:
        train_df["target_low_quality"] = (train_df["ticket_rejected"] == 1).astype(int)
        
    # 3. Night-Time Submission Target
    if "hour" in train_df.columns:
        train_df["target_night"] = ((train_df["ticket_rejected"] == 1) & ((train_df["hour"] < 7) | (train_df["hour"] > 20))).astype(int)
    else:
        train_df["target_night"] = (train_df["ticket_rejected"] == 1).astype(int)
        
    # 4. Missing Junction Target
    if "has_junction" in train_df.columns:
        train_df["target_no_junction"] = ((train_df["ticket_rejected"] == 1) & (train_df["has_junction"] == 0)).astype(int)
    else:
        train_df["target_no_junction"] = (train_df["ticket_rejected"] == 1).astype(int)

    # Ensure all target columns have at least 2 classes
    for col in ["target_low_quality", "target_night", "target_no_junction"]:
        if train_df[col].nunique() < 2:
            train_df.loc[train_df.sample(frac=0.10, random_state=42).index, col] = 1

    feature_cols = _get_feature_cols(train_df)
    X = train_df[feature_cols]

    def _train_single(y_col, desc):
        y = train_df[y_col]
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        dtrain = lgb.Dataset(X_train, label=y_train)
        dtest  = lgb.Dataset(X_test,  label=y_test, reference=dtrain)
        
        params = {
            "objective":        "binary",
            "metric":           "auc",
            "learning_rate":    0.05,
            "num_leaves":       63,
            "min_data_in_leaf": 20,
            "feature_fraction": 0.8,
            "bagging_fraction": 0.8,
            "bagging_freq":     5,
            "verbose":          -1,
        }
        
        model = lgb.train(
            params, dtrain, num_boost_round=300,
            valid_sets=[dtest],
            callbacks=[lgb.early_stopping(30), lgb.log_evaluation(False)],
        )
        
        auc = roc_auc_score(y_test, model.predict(X_test))
        print(f"      Model [{desc}] trained - AUC: {auc:.4f}")
        return model, auc

    print(f"      Training on {len(train_df):,} known-outcome records with {len(feature_cols)} features")
    model_overall, auc_overall = _train_single("ticket_rejected", "Overall Rejection")
    model_low_quality, auc_lq = _train_single("target_low_quality", "Low Quality Reason")
    model_night, auc_night = _train_single("target_night", "Night Time Reason")
    model_no_junction, auc_nj = _train_single("target_no_junction", "Missing Junction Reason")

    model_dict = {
        "model_overall": model_overall,
        "model_low_quality": model_low_quality,
        "model_night": model_night,
        "model_no_junction": model_no_junction,
        "feature_cols": feature_cols,
        "aucs": {
            "overall": auc_overall,
            "low_quality": auc_lq,
            "night": auc_night,
            "no_junction": auc_nj
        }
    }

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model_dict, f)
    print(f"✅  All 4 ASTraM models saved → {MODEL_PATH}")
    return model_dict


def load_classifier():
    with open(MODEL_PATH, "rb") as f:
        data = pickle.load(f)
    if isinstance(data, dict) and "model_overall" in data:
        return data
    elif isinstance(data, dict):
        model = data["model"]
        model.feature_cols = data.get("feature_cols", BASE_FEATURES + ENRICHED_FEATURES)
        return {"model_overall": model, "feature_cols": model.feature_cols}
    else:
        model = data
        model.feature_cols = BASE_FEATURES
        return {"model_overall": model, "feature_cols": model.feature_cols}


def predict_rejection_risk(model_dict, photo_quality, hour, zone_type,
                            violation_type, criticality, day_of_week,
                            sent_to_scita=1, has_junction=0,
                            vehicle_violation_count=1,
                            officer_reject_rate=None,
                            zone_reject_rate=None) -> dict:
    global_mean = 0.167
    row = pd.DataFrame([{
        "photo_quality_score":    photo_quality,
        "hour":                   hour,
        "is_peak_hour":           int(7 <= hour <= 10 or 17 <= hour <= 20),
        "day_of_week":            day_of_week,
        "zone_type":              zone_type,
        "criticality":            criticality,
        "sent_to_scita":          sent_to_scita,
        "has_junction":           has_junction,
        "vehicle_violation_count":vehicle_violation_count,
        "officer_reject_rate":    officer_reject_rate or global_mean,
        "zone_reject_rate":       zone_reject_rate or global_mean,
    }])
    row = _encode(row)
    
    # Parse models from container
    if isinstance(model_dict, dict) and "model_overall" in model_dict:
        model_overall = model_dict["model_overall"]
        model_lq = model_dict.get("model_low_quality")
        model_night = model_dict.get("model_night")
        model_nj = model_dict.get("model_no_junction")
        feature_cols = model_dict.get("feature_cols", BASE_FEATURES)
    else:
        # Bare model fallback
        model_overall = model_dict
        model_lq = None
        model_night = None
        model_nj = None
        feature_cols = getattr(model_dict, "feature_cols", BASE_FEATURES)
        
    available = [f for f in feature_cols if f in row.columns]
    
    score_overall = float(model_overall.predict(row[available])[0])
    score_lq = float(model_lq.predict(row[available])[0]) if model_lq else (0.35 if photo_quality < 0.65 else 0.05)
    score_night = float(model_night.predict(row[available])[0]) if model_night else (0.45 if (hour < 7 or hour > 20) else 0.05)
    score_nj = float(model_nj.predict(row[available])[0]) if model_nj else (0.25 if has_junction == 0 else 0.05)

    reasons = []
    if score_lq > 0.40:
        reasons.append(f"📷 Low Photo Quality (risk: {score_lq*100:.0f}%) — image is likely blurry/low contrast. Clean lens or check focus.")
    if score_night > 0.40:
        reasons.append(f"🌙 Night / Low Light (risk: {score_night*100:.0f}%) — scene has poor ambient lighting. repoisiton or enable flash.")
    if score_nj > 0.40:
        reasons.append(f"📍 Missing Junction Tag (risk: {score_nj*100:.0f}%) — coordinate points are outside registered intersection zone.")
        
    if not reasons:
        if score_overall > 0.45:
            reasons.append(f"⚠️ Marginal Validation Risk (overall: {score_overall*100:.0f}%) — check section cited matches violation type.")
        else:
            reasons.append("✅ Low risk detected — submittal quality standards satisfied.")

    return {
        "risk_score": round(score_overall, 3),
        "risk_pct":   f"{score_overall*100:.0f}%",
        "verdict": (
            "🔴 HIGH RISK — Do not submit yet"         if score_overall > 0.65 else
            "🟡 MEDIUM RISK — Review before submitting" if score_overall > 0.35 else
            "🟢 LOW RISK — Good to submit"
        ),
        "reasons": reasons,
        "reason_probabilities": {
            "low_quality": round(score_lq, 3),
            "night": round(score_night, 3),
            "no_junction": round(score_nj, 3)
        }
    }

