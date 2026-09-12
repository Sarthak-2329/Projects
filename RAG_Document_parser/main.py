from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="RAG Document Parser",
    description="Week 2 Portfolio Project: Query Pipeline with Grounded Citations",
    version="2.0.0"
)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "Welcome to the RAG Document Parser API. Go to /docs for the API reference."}
