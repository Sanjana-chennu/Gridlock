# 🚦 Vyuha System — Next.js & FastAPI Teammate Run Guide

This guide covers setting up, training, and running the **Vyuha Intelligence System** using the **FastAPI Backend REST API** and the **Next.js React Frontend Website**.

---

## 🛠️ Step 1: Backend Setup & Model Training

The backend processes raw traffic logs and runs the LightGBM models for ticket validation.

```bash
# 1. Setup virtual environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 2. Configure environment keys
cp .env.example .env
# Edit .env and configure GEMINI_API_KEY (from https://aistudio.google.com)

# 3. Process data and train the LightGBM models
python setup_and_train.py
```

### Start the FastAPI REST API:
```bash
source venv/bin/activate
uvicorn api_server.py --reload --port 8000
```
* **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Status Endpoint**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 💻 Step 2: Next.js React Frontend Setup

The fully featured React frontend runs on Node.js and connects to the FastAPI backend.

```bash
# Navigate into the frontend folder
cd web

# Install node packages (Tailwind, Recharts, MapLibre, etc.)
npm install

# Run the Next.js development server
npm run dev
```

* **Frontend URL**: [http://localhost:3000](http://localhost:3000)

---

## 📂 React Web App Navigation Directory

The Next.js website exposes all policing engines through the following routes:

### 1. ⚡ Tactical Operations (`/tactical`)
* **H3 Hex Hotspots Map**: High-resolution spatial clustering of violations via Uber H3 hexagons. Displays the Congestion Relief Score (CRS) heatmap.
* **Patrol routing**: Solves TSP to show three optimized patrol paths.
* **Chronic Offender Registry**: Interactive search for the top-1% repeat traffic violators.
* **Ticket Rejection Risk Predictor**: Uses the pre-trained LightGBM model to evaluate quality parameters before submittal.

### 2. 🏛️ Policy Analysis (`/structural`)
* **Deterrence Failure Score (DFS)**: Isolates zones where weekly enforcement visits failed to reduce violations.
* **SCITA Latency Audit**: Charts administrative delays in sending fines to offenders and tracks monthly latency trends.
* **BBMP Proposals Generator**: Uses Gemini to auto-draft structural infrastructure upgrade briefs (bollards, bus bays, yellow grids) based on OSM nearby POIs.

### 3. 📊 Quality Control (`/audit`)
* **Hotspots Map**: Green, yellow, and red color-coded rejection rate indicators across all 54 zones.
* **Defect Inspector & Operational Suggestions**: Visualizes why tickets are failing (Low Quality, Night/Low Light, GPS tags) and serves field-officer action checklists.
