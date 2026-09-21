import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

app = FastAPI(
    title="RAG Document Parser",
    description="Week 4 Portfolio Project: Hybrid Search, Evaluation, and Deployed Full-Stack RAG",
    version="4.0.0"
)

# ---------------------------------------------------------------------------
# CORS — required for the Next.js frontend (localhost:3000) to call the API.
# In production, set CORS_ORIGINS to a comma-separated allowlist of domains.
# ---------------------------------------------------------------------------
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "Welcome to the RAG Document Parser API. Go to /docs for the API reference."}
