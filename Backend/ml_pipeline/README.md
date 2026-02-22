# ML Pipeline (Backend/ml_pipeline)

Quick start

- Install dependencies: `pip install -r requirements.txt`
- Run API + scheduled retrain: `python deploy_api.py`

Docker

- Build: `docker build -t stellara-ml-pipeline .`
- Run: `docker run -p 8000:8000 stellara-ml-pipeline`

Files

- `data_processing.py` — ingestion & feature engineering
- `train.py` — trains engagement & recommender models
- `model_utils.py` — load/save helpers
- `deploy_api.py` — FastAPI prediction + background retrain scheduler
- `scheduler.py` — helper for scheduling retrain
