import os
import joblib


def ensure_models_dir(base):
    os.makedirs(base, exist_ok=True)


def save_model(obj, path):
    ensure_models_dir(os.path.dirname(path) or ".")
    joblib.dump(obj, path)


def load_model(path):
    if not os.path.exists(path):
        return None
    return joblib.load(path)
