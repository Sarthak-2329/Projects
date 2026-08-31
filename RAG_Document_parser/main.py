from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="RAG Document Parser",
    description="Week 1 Portfolio Project: Document Ingestion Pipeline",
    version="1.0.0"
)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "Welcome to the RAG Document Parser API. Go to /docs for the API reference."}
