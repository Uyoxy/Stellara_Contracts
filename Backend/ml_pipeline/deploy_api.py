import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from model_utils import load_model
from train import train_all
from scheduler import start_scheduler

app = FastAPI(title="Stellara ML Pipeline")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")


class SessionPayload(BaseModel):
    session_duration: float
    pages_viewed: int
    actions: int
    hour: int
    # item_category one-hot expected to be provided optionally


class RecommendRequest(BaseModel):
    user_id: str = None
    item_id: str = None


def load_engagement():
    obj = load_model(os.path.join(MODEL_DIR, "engagement.joblib"))
    return obj


def load_recommender():
    return load_model(os.path.join(MODEL_DIR, "recommender.joblib"))


@app.post("/predict_engagement")
def predict(payload: SessionPayload):
    m = load_engagement()
    if not m:
        raise HTTPException(status_code=503, detail="Engagement model not available")
    features = m["features"]
    row = [payload.__dict__.get(f, 0) for f in features]
    Xs = m["scaler"].transform([row])
    prob = m["model"].predict_proba(Xs)[0, 1]
    return {"engagement_probability": float(prob)}


@app.post("/recommend")
def recommend(req: RecommendRequest):
    rec = load_recommender()
    if not rec:
        raise HTTPException(status_code=503, detail="Recommender not available")
    nn = rec["nn"]
    items = rec["items_index"]
    # if item_id provided, find its index
    if req.item_id and req.item_id in items:
        idx = items.index(req.item_id)
        # we need the stored item vector; NearestNeighbors can't return vectors easily here,
        # but we can use kneighbors on the same index
        dists, nbrs = nn.kneighbors(nn._fit_X[idx:idx+1])
        picks = [items[i] for i in nbrs[0]]
    else:
        # fallback: return top-K by index
        picks = items[:5]
    return {"recommendations": picks}


if __name__ == "__main__":
    # start a daily retrain (24h) in background and run the API
    start_scheduler(train_all, hours=24)
    uvicorn.run(app, host="0.0.0.0", port=8000)
