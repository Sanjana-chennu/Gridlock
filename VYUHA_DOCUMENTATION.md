# 🚦 Vyuha Intelligence System

> **AI-Powered Spatial Analytics, ML Quality Control, and Patrol Router for Bengaluru Traffic Police (BTP)**

Vyuha is an institutional operational suite designed for the Bengaluru Traffic Police. It pairs spatial analytics (**Uber H3 Index & CartoDB Maps**), machine learning (**LightGBM**), and generative AI (**Gemini 2.5 Flash**) to optimize enforcement beats, isolate repeat offenders, run automated CCTV recovery, and draft BBMP infrastructure briefs.


## 🗺️ Architectural & Feature Directory

The system is structured as a **Next.js Frontend Dashboard** (running on port `3000`) consuming analytics from a **Python FastAPI Backend** (running on port `8000`). It features 9 core modules grouped under three main sections:

## ⚡ 1. Tactical Enforcement

*Designed for on-field inspectors and traffic control rooms to run real-time police intercepts.*

### Patrol Beat Optimizer (`/resource-optimizer`)

- Spatially clusters BTP violation tick data into high-resolution **Uber H3 Hexagonal Grid Cells**.
- Renders interactive maps displaying the **Congestion Relief Score (CRS)** for each beat.
- Solves a Traveling Salesperson Problem (TSP) to generate optimized patrol routes.

### Chronic Offenders (`/chronic-offenders`)

- Isolates the **top chronic repeat offenders** based on violation velocity and elapsed time.
- Sorts and filters offenders by risk profiles, enabling targeted traffic stops.

### CCTV Scanner & Portal (`/cctv-scanner`)

- Simulates recovering evidence frames from municipal CCTV nodes.
- Uses OpenCV edge detection and OCR (**EasyOCR**) to read and reconstruct license plates.


## 🏛️ 2. Civic & Structural

*Designed for senior BTP officers and urban policy planners.*

### Deterrence Inspector (`/deterrence-inspector`)

- Identifies **Enforcement-Resistant Hotspots** where repeated intercepts fail.
- Quantifies locations using a custom **Deterrence Failure Score (DFS)**.

### Civic Brief Generator (`/civic-brief`)

- Combines local Point-of-Interest (POI) data and satellite imagery.
- Uses **Gemini 2.5 Flash** to draft structured BBMP infrastructure briefs.

Suggested interventions include:

- Yellow grids
- Street lights
- Bus bays
- Road redesign improvements

### SCITA Queue Tracker (`/scita-queue`)

- Audits administrative latency between violation detection and notice delivery.
- Provides interactive timeline and scatter chart analytics.


## 📊 3. Audit & Compliance

*Designed for Quality Control and automated evidence verification.*

### Rejection Hotspots (`/rejection-map`)

- Plots rejection rates across **54 BTP zones**.
- Detects evidence issues including:
  - low light
  - blurry images
  - missing metadata

### Rejection Risk Model (`/rejection-classifier`)

Pre-submission LightGBM classifier predicting ticket rejection probability.

Model telemetry:

| Metric | Score |
|---|---|
| ROC-AUC | 0.824 |
| Accuracy | 84.3% |

Includes:

- Stratified cross validation
- Feature importance analysis
- Risk probability scoring

### Photo Shield Auditor (`/photo-shield`)

Real-time compliance checker evaluating:

- Camera blur using Laplacian variance
- Contrast quality
- License plate frame visibility


## Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Python
- FastAPI

### Machine Learning

- LightGBM
- Scikit-learn

### Computer Vision

- OpenCV
- EasyOCR

### Spatial Analytics

- Uber H3
- CartoDB Maps

### Generative AI

- Gemini 2.5 Flash

## Live Demo

Access the deployed Vyuha Intelligence System:

**[Live Demo](https://gridlock-swart.vercel.app/resource-optimizer)**
## Demo Video

A complete walkthrough demonstrating Vyuha’s workflow, intelligence modules, and real-world traffic enforcement use cases:

**[Watch Demo Video](https://drive.google.com/file/d/1t5SOkWiWZUYA_FLBsYpI5BWxkdVjDcMp/view?usp=sharing)**

---

## 🛠️ Setup & Running Guide

Requirements:

- Python 3.10+
- Node.js 18+


### Backend Setup

Create and activate virtual environment:

**Linux / macOS**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows**

```bash
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure environment variables:

```bash
cp .env.example .env
```

Set up all required API keys and configuration values according to the provided `.env.example` file.

Train models and generate required data:

```bash
python setup_and_train.py
```

Start FastAPI backend:

```bash
uvicorn api_server:app --port 8000
```

API documentation:

```text
http://localhost:8000/docs
```

---

### Frontend Setup

Navigate to the frontend directory:

```bash
cd web
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Dashboard:

```text
http://localhost:3000
```



## 📂 Repository Layout

```text
├── app/                            # Legacy Streamlit scripts
├── data/                           # Violation datasets and geo JSONs
├── models/                         # Trained LightGBM models
├── vyuha/                          # Backend core logic
│   ├── hex_engine.py               # H3 grid spatial mapping & TSP routing
│   ├── chronic_registry.py         # Chronic offender scoring algorithms
│   ├── dfs_engine.py               # Deterrence failure score calculations
│   ├── plate_detector.py           # Subprocess plate detection controller
│   ├── run_detection.py            # EasyOCR and OpenCV standalone OCR script
│   └── satellite_agent.py          # Gemini vision BBMP brief compiler
├── web/                            # Modern Next.js Frontend Dashboard
│   ├── app/                        # Route pages for all 9 core features
│   ├── components/                 # Shared components (Sidebar, Navbar)
│   ├── lib/                        # API fetch integrations
│   └── globals.css                 # Lavender light theme design tokens
├── api_server.py                   # REST FastAPI backend
├── setup_and_train.py              # Parquet dataset compiler and model trainer
├── Dockerfile                      # Docker container configuration
├── VYUHA_DOCUMENTATION.md          # Complete project documentation
└── README.md                       # Repository overview
```


## Overview

Vyuha transforms traffic enforcement into a proactive intelligence platform by combining:

- Spatial analytics
- Predictive machine learning
- Computer vision automation
- Generative AI assistance

to enable smarter, faster, and more reliable urban traffic management.
