# FinLens AI Deployment Guide

FinLens AI consists of two components:
- **Frontend**: React + Vite + Tailwind CSS (SPA)
- **Backend**: FastAPI + Python (Gemini AI + Google Speech TTS + SQLite)

---

## Option 1: Render (Recommended — 1-Click Blueprint)

Deploy both frontend and backend together using the included `render.yaml`:

1. Push this repository to GitHub.
2. Log in to [Render](https://render.com/).
3. Click **New +** &rarr; **Blueprint**.
4. Connect your `FinLens` repository and select branch `test-deploy` (or `main`).
5. Render will automatically detect `render.yaml` and configure:
   - `finlens-backend` (Web Service, Python)
   - `finlens-frontend` (Static Site)
6. Add your Environment Variable:
   - **`GEMINI_API_KEY`**: Your Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/).
7. Click **Apply**. Both services will build and deploy automatically!

---

## Option 2: Vercel (Frontend) + Render / Railway (Backend)

### Step 1: Deploy Backend (Render)
1. In Render, click **New +** &rarr; **Web Service**.
2. Connect your repo and configure:
   - **Root Directory**: `backend`
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Add Environment Variables:
   - `GEMINI_API_KEY`: `<your_gemini_api_key>`
   - `GEMINI_MODEL`: `gemini-3.6-flash`
   - `FRONTEND_URL`: `https://your-frontend-app.vercel.app` *(or comma-separated URLs)*
4. Click **Create Web Service** and copy your backend URL (e.g. `https://finlens-backend.onrender.com`).

### Step 2: Deploy Frontend (Vercel)
1. Log in to [Vercel](https://vercel.com/) and click **Add New...** &rarr; **Project**.
2. Import your `FinLens` repository.
3. In Project Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://finlens-backend.onrender.com` *(your Render backend URL)*
5. Click **Deploy**.
6. Once deployed, copy your Vercel URL and update `FRONTEND_URL` on your backend service if needed.

---

## Option 3: Docker & Docker Compose

To run the entire production-ready stack in containers:

```bash
# 1. Set your Gemini API Key
export GEMINI_API_KEY="your-gemini-api-key"

# 2. Build and start containers
docker-compose up --build
```

- Frontend will be live on: `http://localhost:5173`
- Backend API will be live on: `http://localhost:8000`

---

## Required Environment Variables

| Variable | Service | Description |
|---|---|---|
| `GEMINI_API_KEY` | Backend | Google Gemini API key from Google AI Studio |
| `GEMINI_MODEL` | Backend | Default model (`gemini-3.6-flash`) |
| `FRONTEND_URL` | Backend | Deployed frontend URL for CORS (e.g. `https://my-finlens.vercel.app`) |
| `VITE_API_BASE_URL` | Frontend | Deployed backend URL (e.g. `https://my-backend.onrender.com`) |
