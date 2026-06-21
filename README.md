# 🚦 Vyuha Intelligence System
> **AI-Powered Spatial Analytics, ML Quality Control, and Patrol Router for Bengaluru Traffic Police (BTP)**

Vyuha is an institutional operational suite designed for the Bengaluru Traffic Police. It pairs spatial analytics (Uber H3 Index & CartoDB Maps), machine learning (LightGBM), and generative AI (Gemini 2.5 Flash) to optimize enforcement beats, isolate repeat offenders, run automated CCTV recovery, and draft BBMP infrastructure briefs.

---

## 🗺️ Architectural & Feature Directory

The system is structured as a **Next.js Frontend Dashboard** (running on port `3000`) consuming analytics from a **Python FastAPI Backend** (running on port `8000`). It features 9 core modules grouped under three main sections:

### ⚡ 1. Tactical Enforcement
*Designed for on-field inspectors and traffic control rooms to run real-time police intercepts.*
* **Patrol Beat Optimizer (`/resource-optimizer`)**
  * Spatially clusters BTP violation tick data into high-resolution **Uber H3 Hexagonal Grid Cells**.
  * Renders interactive light maps displaying the **Congestion Relief Score (CRS)** for each beat.
  * Solves a Traveling Salesperson Problem (TSP) to generate optimized, sequential patrol routes for intercepts.
* **Chronic Offenders (`/chronic-offenders`)**
  * Isolates the **top chronic repeat offenders** based on violation velocity and elapsed time.
  * Sorts and filters offenders by risk profiles, enabling targeted traffic stops.
* **CCTV Scanner & Portal (`/cctv-scanner`)**
  * Simulates recovering evidence frames from municipal CCTV nodes when traffic officers miss escaping vehicles.
  * Uses OpenCV edge detection and OCR (EasyOCR) to read and reconstruct license plates.

### 🏛️ 2. Civic & Structural
*Designed for senior BTP officers and urban policy planners to address systemic traffic issues.*
* **Deterrence Inspector (`/deterrence-inspector`)**
  * Identifies **Enforcement-Resistant Hotspots** where repeat police intercepts have failed to curb infractions (quantified via a custom **Deterrence Failure Score (DFS)**).
* **Civic Brief Generator (`/civic-brief`)**
  * Combines local Point-of-Interest (POI) data (schools, hospitals, transit hubs) and satellite imagery.
  * Uses **Gemini 2.5 Flash** to draft formal, structured BBMP (Bruhat Bengaluru Mahanagara Palike) infrastructure briefs, suggesting physical countermeasures like yellow grids, street lights, or bus bays.
* **SCITA Queue Tracker (`/scita-queue`)**
  * Audits administrative latency (days elapsed between violation detection and court notice delivery) using interactive timelines and scatter charts.

### 📊 3. Audit & Compliance
*Designed for administrative Quality Control (QC) and automated pre-submission evidence verification.*
* **Rejection Hotspots (`/rejection-map`)**
  * Plots rejection rates across **all 54 BTP zones** using color-coded maps (low, medium, and worst quality).
  * Attributes defect rates (e.g. low light, blurry photos, missing tags) and suggests checklists.
* **Rejection Risk Model (`/rejection-classifier`)**
  * Pre-submission LightGBM classifier simulator predicting the probability of a ticket being rejected before submission.
  * Displays model diagnostics telemetry (ROC-AUC `0.824`, accuracy `84.3%`, Stratified CV, and relative feature weights).
* **Photo Shield Auditor (`/photo-shield`)**
  * Real-time compliance gatekeeper checking evidence photo quality.
  * Evaluates uploaded photos for camera blur (Laplacian variance), contrast (low light check), and license plate frame focus ratios.

---

## 🛠️ Setup & Running Guide

Ensure you have **Python 3.10+** and **Node.js 18+** installed.

### 1. Set Up the Python Backend

```bash
# Initialize virtual environment
python3 -m venv venv
source venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt

# Create and configure .env
cp .env.example .env
```
*Note: Make sure to add your `GEMINI_API_KEY` to the `.env` file to drive the Civic Brief generative agent.*

Train the LightGBM classifier and generate the violation dataset:
```bash
python setup_and_train.py
```

Start the FastAPI backend:
```bash
uvicorn api_server:app --port 8000
```
The REST API documentation is available at `http://localhost:8000/docs`.

### 2. Set Up the Next.js Frontend

Navigate to the frontend folder, install packages, and launch:
```bash
cd web
npm install
npm run dev
```
The polished dashboard runs at **`http://localhost:3000`**.

---

## 📂 Repository Layout

```
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
└── README.md                       # Root documentation
```
