# DermAI — Real-Time Skin Disease Classification & Decision Support

An end-to-end dermatological screening decision-support platform powered by **Vision Transformers (ViT)** and **CNN baselines**, featuring **Explainable AI (Attention Heatmaps)** and **Uncertainty Estimation**.

---

## 🏗 System Architecture

- **Primary Architecture**: Vision Transformer (`vit_base_patch16_224` via `timm`) & ResNet50 Baseline.
- **Explainability (XAI)**: Vision Transformer Attention Map Overlays.
- **Uncertainty**: Shannon Entropy calculation with automatic referral recommendations.
- **Backend**: FastAPI REST API with SQLite logging & Pydantic validation.
- **Frontend**: React + Vite UI featuring Drag-and-Drop upload, Live Webcam capture, Disease Encyclopedia, and Log History.

---

## 📁 Repository Structure

```
├── backend/                  # FastAPI Application
│   ├── app/
│   │   ├── api/              # REST Endpoints (/predict, /diseases, /history)
│   │   ├── data/             # Medical Knowledge Base (diseases.json, SQLite DB)
│   │   ├── models/           # SQLAlchemy Models
│   │   ├── schemas/          # Pydantic Schemas
│   │   ├── services/         # Classifier & Database Services
│   │   └── main.py           # FastAPI Application Entry
│   └── tests/                # Pytest Test Suite
├── configs/                  # Hyperparameters & Paths (config.yaml)
├── frontend/                 # React + Vite Healthcare Dashboard
├── models/                   # Saved PyTorch Checkpoints (.pth)
├── notebooks/                # Google Colab / GPU Training Notebooks
├── processed_dataset/        # Stratified Manifests (train, val, test CSVs)
├── reports/                  # Data cleaning & Evaluation Confusion Matrices
├── scripts/                  # Data & Model Scripts
│   ├── dataset.py            # PyTorch Dataset, Transforms & DataLoader
│   ├── models.py             # ViT & ResNet Model Factory
│   ├── train.py              # Model Training Pipeline (Cosine Annealing + Warmup)
│   ├── evaluate.py           # Metrics & Confusion Matrix Generator
│   └── predict.py            # CLI Inference & XAI Attention Overlay
├── requirements.txt          # Python Dependencies
└── docker-compose.yml        # Docker Orchestration
```

---

## 🚀 Quickstart Guide

### 1. Python Environment Setup
```bash
pip install -r requirements.txt
```

### 2. Model Training
- **Smoke test / Dry run (Fast 1-epoch local check)**:
  ```bash
  python scripts/train.py --smoke-test
  ```
- **Full Model Training**:
  ```bash
  python scripts/train.py --model vit_base_patch16_224 --epochs 20 --batch-size 32 --lr 0.0001
  ```
- **Google Colab / Cloud Training**: Open [`notebooks/03_train_vit.ipynb`](notebooks/03_train_vit.ipynb).

### 3. Model Evaluation
```bash
python scripts/evaluate.py --checkpoint models/best_vit_base_patch16_224.pth
```
Outputs classification report and confusion matrix to `reports/evaluation/`.

### 4. Running Backend Server
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation available at: `http://localhost:8000/docs`

### 5. Running Frontend Web App
```bash
cd frontend
npm run dev
```
Open your browser at: `http://localhost:3000`

---

## ⚖️ Medical Disclaimer
This software is intended strictly for research and decision-support educational screening. It is not an official clinical diagnostic device and must not replace professional dermatological consultation or biopsy.
