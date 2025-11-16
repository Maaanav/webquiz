# backend/main.py
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services import init_db
from routes import router as api_router

# optional: google genai import left as-is (ok if not configured)
try:
    from google import genai
except Exception:
    genai = None

app = FastAPI(title="Quiz Web - Python Backend (compact)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev: allow all origins. For production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount all routes under /api so frontend can call /api/...
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
async def startup_event():
    # initialize DB (creates tables if missing)
    init_db()
    # optional: check GenAI client availability
    if genai:
        try:
            _ = genai.Client()
        except Exception as e:
            print("GenAI client init failed (ok if not configured):", e)

@app.get("/")
async def root():
    return {"status": "Quiz Web Python Backend running"}
