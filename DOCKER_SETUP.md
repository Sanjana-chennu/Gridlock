# 🚦 Vyuha Intelligence System — Running Guide

This guide explains how to run the complete Vyuha system locally.

The project is fully containerized using Docker. Both the FastAPI backend and the Next.js frontend can be started together using a single Docker Compose command.

---

# 🐳 Running with Docker 

## Prerequisites

Install:

- Docker Desktop
- Git

Verify Docker installation:

```bash
docker --version

docker compose version
```

---

## 1. Clone the Repository

```bash
git clone <repository-url>

cd Gridlock
```

---

## 2. Configure Environment Variables

The project uses external AI and mapping services.

Create a `.env` file from the provided template.

Linux / Mac:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update the `.env` file:

```env
# Gemini AI API key
GEMINI_API_KEY=your_gemini_api_key_here

# MapMyIndia / Mappls API key
MAPPLS_API_KEY=your_mappls_api_key_here

# Dataset mode
DATA_MODE=real

# Groq API key
GROQ_API_KEY=your_groq_api_key_here
```

The `.env` file stores private credentials and should not be committed.

---

## 3. Start the Application

From the project root directory:

```bash
docker compose up --build
```

Docker will automatically:

- Build the Python FastAPI backend
- Install all Python dependencies
- Load the Vyuha ML services
- Build the Next.js frontend
- Install all Node dependencies
- Connect frontend and backend services

No manual setup is required.

---

# 🌐 Access the Application

After the containers start successfully:

## Frontend Dashboard

```
http://localhost:3000
```

## Backend API

```
http://localhost:7860
```

## Swagger API Documentation

```
http://localhost:7860/docs
```


---

# ⚙️ Services

## Backend Service

Technology:

- Python
- FastAPI
- Uvicorn
- LightGBM ML pipeline
- Gemini/Groq AI integrations
- Spatial analytics modules

Container port:

```
7860
```

---

## Frontend Service

Technology:

- Next.js
- React
- TypeScript

Container port:

```
3000
```

The frontend communicates with the backend internally through the Docker network.

---


# Notes

- Docker setup does not require creating a Python virtual environment.
- Docker setup does not require running npm install manually.
- All dependencies are installed inside containers.
- The complete system can be launched with:

```bash
docker compose up --build
```
