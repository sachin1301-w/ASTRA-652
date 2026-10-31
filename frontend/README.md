# FinLens AI — Frontend

The modern React + Vite client for **FinLens AI**, providing an intuitive command centre for personal finance, multi-document analysis, multilingual audio readouts, and interactive 3D avatar advisory.

## 🚀 Key Features

- **Personal Finance Dashboard:** Real-time financial twin metrics (income, expenses, EMIs, savings, net cash flow).
- **Document Intelligence Hub:** Upload and analyze loan agreements, salary slips, ITRs, insurance policies, and Form 16.
- **हिंदी में समझें और सुनें:** Dedicated Hindi document explanation card with one-click voice readout and stop controls.
- **Universal Voice Output:** Automatic failover from client-side Web Speech API to backend Google TTS (POST /api/speech/tts), ensuring Hindi speech plays cleanly across Windows, Mac, iOS, and Android.
- **3D Convai Advisor:** Live voice-first conversational 3D financial advisor with dynamic in-page Experience ID configuration and localStorage persistence.
- **Financial Twin Simulator:** Interactive "What-If" scenario sandbox for loans, investments, and risk tolerance adjustments.

## 🛠️ Tech Stack

- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS + Lucide React Icons
- **Data Visualization:** Recharts
- **Client OCR:** Tesseract.js (for images & scanned slips)
- **Speech & Audio:** Web Speech API + HTML5 Audio (gTTS stream fallback)
- **Routing:** React Router DOM (v7)

## 📦 Local Development

`ash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Create .env from template
cp .env.example .env

# 4. Start local development server
npm run dev
`

The app will be accessible at http://localhost:5173.

### Demo Login
- **Email:** demo@finlens.ai
- **Password:** 123456

## ⚙️ Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| VITE_API_BASE_URL | Base URL of the backend FastAPI service | http://localhost:8000 |
| VITE_CONVAI_EXPERIENCE_ID | Default Convai Experience ID for the 3D advisor | *(Optional, can also be configured in UI)* |