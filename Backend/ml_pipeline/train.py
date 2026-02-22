import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import NearestNeighbors
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import numpy as np
import pandas as pd

from data_processing import get_processed
from model_utils import save_model


MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


def train_engagement(df: pd.DataFrame):
    features = [c for c in df.columns if c not in ("user_id","item_id","timestamp","engaged")]
    X = df[features].fillna(0)
    y = df["engaged"].astype(int)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X_train_s, y_train)
    acc = clf.score(X_test_s, y_test)
    print(f"Engagement model accuracy: {acc:.3f}")
    save_model({"model": clf, "scaler": scaler, "features": features}, os.path.join(MODEL_DIR, "engagement.joblib"))


def train_recommender(df: pd.DataFrame):
    # Simple item-feature embedding from one-hot category columns + popularity
    cat_cols = [c for c in df.columns if c.startswith("cat_")]
    items = df.groupby("item_id")[cat_cols + ["user_id"]].agg({**{c: "max" for c in cat_cols}, "user_id": "nunique"})
    if items.shape[0] < 2:
        print("Not enough items to train recommender; skipping.")
        return
    X = items[cat_cols].fillna(0).values
    nn = NearestNeighbors(n_neighbors=min(10, len(items)-1), metric="cosine")
    nn.fit(X)
    save_model({"nn": nn, "items_index": items.index.tolist(), "cat_cols": cat_cols}, os.path.join(MODEL_DIR, "recommender.joblib"))
    print("Recommender trained on", len(items), "items")


def train_all(input_path=None):
    print("Starting training run...")
    df = get_processed(input_path)
    os.makedirs(MODEL_DIR, exist_ok=True)
    try:
        train_engagement(df)
        train_recommender(df)
        print("Training complete.")
    except Exception as e:
        print("Training failed:", e)


if __name__ == "__main__":
    train_all()
