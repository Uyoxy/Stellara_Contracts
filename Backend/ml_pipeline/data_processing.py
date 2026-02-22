import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


def ensure_dirs(base):
    os.makedirs(base, exist_ok=True)


def generate_synthetic(path, n=1000):
    ensure_dirs(os.path.dirname(path) or ".")
    rng = np.random.default_rng(42)
    now = datetime.utcnow()
    rows = []
    categories = ["crypto","finance","ml","web3","misc"]
    for i in range(n):
        user_id = f"user_{rng.integers(1,200)}"
        session_length = abs(int(rng.normal(300, 120)))
        pages = max(1, int(rng.normal(5, 2)))
        actions = max(0, int(rng.poisson(3)))
        item_id = f"item_{rng.integers(1,200)}"
        item_cat = rng.choice(categories)
        ts = now - timedelta(minutes=int(rng.integers(0, 60*24*30)))
        rows.append({
            "user_id": user_id,
            "session_duration": session_length,
            "pages_viewed": pages,
            "actions": actions,
            "item_id": item_id,
            "item_category": item_cat,
            "timestamp": ts,
        })
    df = pd.DataFrame(rows)
    df.to_csv(path, index=False)
    return df


def load_raw(path=None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "data", "user_behavior.csv")
    if not os.path.exists(path):
        print(f"Input data not found at {path}, generating synthetic sample.")
        return generate_synthetic(path)
    return pd.read_csv(path, parse_dates=["timestamp"]) 


def process(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # Engagement label: session_duration > 300s
    df["engaged"] = (df["session_duration"] > 300).astype(int)
    # Basic features
    df["hour"] = df["timestamp"].dt.hour
    # one-hot item_category
    df = pd.get_dummies(df, columns=["item_category"], prefix="cat")
    return df


def get_processed(input_path=None):
    df = load_raw(input_path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    processed = process(df)
    out_dir = os.path.join(os.path.dirname(__file__), "data")
    ensure_dirs(out_dir)
    processed_path = os.path.join(out_dir, "processed.parquet")
    processed.to_parquet(processed_path, index=False)
    return processed


if __name__ == "__main__":
    print("Processing data...")
    df = get_processed()
    print("Wrote processed data with shape:", df.shape)
