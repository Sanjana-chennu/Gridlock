# 🚦 Vyuha Intelligence System
> **AI-Powered Spatial Analytics, ML Quality Control, and Patrol Router for Bengaluru Traffic Police (BTP)**

Vyuha is a next-generation smart-policing operational suite. Built with Python, Streamlit, and FastAPI, it integrates machine learning classifiers (LightGBM), spatial analytics (Uber H3 Index & Folium Maps), and large language models (Gemini) to optimize patrol routing, isolate repeat offenders, run automated CCTV recovery, and draft infrastructure briefs.

---

## 🗺️ Architectural & Feature Directory

The system is split into **three distinct analytical engines**, each mapped to its own navigation view, tabs, and interactive panels:

### ⚡ Engine 1 — Tactical Ops
*Designed for on-field inspectors and traffic control rooms.*
* **Tab 1: 🗺️ Hex Beat Map & Patrol Router**
  * Spatially clusters BTP violation tick data into high-resolution **Uber H3 Hexagonal Grid Cells**.
  * Renders a Folium heat map displaying the **Congestion Relief Score (CRS)** for each zone.
  * Solves a greedy **Traveling Salesperson Problem (TSP)** to generate three optimized patrol routes for police intercepts.
* **Tab 2: ⚠️ Chronic Offender Registry**
  * Isolates the **top-1% chronic offenders** (repeat violators) based on violation velocity and days elapsed since their last infraction.
  * Sorts offenders by custom risk scoring for targeted traffic stops.
* **Tab 3: 📹 CCTV Retrieval Portal**
  * Simulates retrieving frames from municipal CCTV nodes when traffic officers miss escaping vehicles.
  * Employs isolated OpenCV and OCR extraction (EasyOCR) to reconstruct license plates.
  * Evaluates evidence quality using the pre-trained ASTraM rejection risk model before lodging it in the SCITA queue.

### 🏛️ Engine 2 — Structural Policy
*Designed for senior BTP officers and policy planners.*
* **Tab 1: 🔴 Deterrence Failure Map & Proposal Builder**
  * Isolates **Enforcement-Resistant Hotspots** where weekly police visits have failed to curb infractions (quantified via a custom **Deterrence Failure Score (DFS)**).
  * Automatically fetches satellite overview imagery of the selected junction.
  * Queries OpenStreetMap to isolate nearby Points of Interest (POIs) like schools, hospitals, or transit stations.
  * Uses **Gemini 2.5 Flash** to draft formal, structured BBMP (Bruhat Bengaluru Mahanagara Palike) infrastructure briefs (recommending physical changes like elevated curbs, bus bays, yellow grids, or street lights).
* **Tab 2: ⏱️ SCITA Latency Audit**
  * Evaluates administrative overhead by visualizing notice latency (time between violation and notice delivery).
  * Charts monthly latency trends against chronic offender re-offending rates.

### 📊 Engine 3 — Rejection Audit
*Designed for administrative Quality Control and model telemetry.*
* **Hotspots Map & Leaderboard**
  * Plots rejection rates across **all 54 BTP zones** using green, yellow, and red color-coding based on overall quality performance.
* **Defect Attribution Inspector**
  * Dynamically breaks down rejection factors (Low Quality, Low Light/Night, and Missing Junction Tags) for the selected station.
* **Operational Police Suggestions**
  * Formulates highly localized data-driven checklists (e.g. lens cleaning protocols, shift changes, flash attachments, GPS dead zone checks) based on the dominant failure mode.
* **LightGBM ML Diagnostics**
  * Displays telemetry metrics of the LightGBM booster model (e.g., AUC-ROC of `0.82`, accuracy of `84.3%`, training sizes, and relative feature importances).

---

## 🛠️ Step-by-Step Installation & Running Guide

Ensure you have **Python 3.10+** installed on your system.

### 1. Set Up the Environment & Dependencies
Clone the repository, initialize a virtual environment, and install the package requirements:

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies (LightGBM on macOS is configured to download a pre-compiled binary wheel)
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy the template `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Open `.env` and fill in your API credentials:
* **`GEMINI_API_KEY`**: Acquire a free key at [Google AI Studio](https://aistudio.google.com) to drive the BBMP proposal agent.
* **`MAPPLS_API_KEY`**: (Optional) REST API key from MapMyIndia for high-resolution regional maps and localized satellite context. The app falls back to Esri World Imagery (free/keyless) if this is absent.

### 3. Generate the Dataset & Train the Classifier
Run the one-shot pipeline script to process raw BTP violation records (or generate realistic synthetic data if missing) and train the LightGBM models:

```bash
python setup_and_train.py
```
This script will produce:
* `data/processed/violations.parquet` — compiled spatial violation dataset.
* `models/astram_classifier.pkl` — trained LightGBM model bundle.

### 4. Run the Streamlit Dashboard
Launch the frontend dashboard:

```bash
streamlit run app/main.py
```
By default, the dashboard runs at: **`http://localhost:8501`**

### 5. Run the FastAPI Backend (Optional)
If you wish to test or consume the analytical engines via REST endpoints:

```bash
uvicorn api_server.py --reload --port 8000
```
This runs the REST server on: **`http://localhost:8000`**
Documentation can be inspected at: **`http://localhost:8000/docs`**

---

## 📂 Repository Layout

```
├── app/
│   ├── main.py                     # Main dashboard controller and navigation
│   └── pages/
│       ├── 01_tactical_ops.py       # Engine 1 views (Hex Beat, Chronic Registry, CCTV Portal)
│       ├── 02_structural.py         # Engine 2 views (Deterrence map, SCITA latency)
│       └── 03_rejection_audit.py     # Engine 3 views (Quality control, ML diagnostics)
├── data/
│   ├── raw/                         # Raw police logs (if available)
│   └── processed/                   # Aggregated Parquet datasets
├── models/
│   └── astram_classifier.pkl        # Pickle file containing the trained LightGBM models
├── vyuha/
│   ├── __init__.py
│   ├── data_pipeline.py             # Data loading and preprocessing pipeline
│   ├── hex_engine.py                # H3 grid spatial mapping and routing TSP
│   ├── chronic_registry.py          # Chronic offender scoring algorithms
│   ├── dfs_engine.py                # Deterrence failure score computation
│   ├── astram_classifier.pkl        # LightGBM booster wrappers
│   ├── plate_detector.py            # isolated subprocess plate detection controller
│   ├── run_detection.py             # EasyOCR and OpenCV standalone detection script
│   └── satellite_agent.py           # Esri/Mappls imagery and Gemini vision agent
├── api_server.py                    # REST FastAPI Backend
├── setup_and_train.py               # Dataset processing and training pipeline
├── requirements.txt                 # Project package requirements
└── README.md                        # Project documentation
```
