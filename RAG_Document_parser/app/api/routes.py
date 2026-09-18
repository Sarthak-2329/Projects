from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.ingestion import ingest_pdf
from app.services.ingestion import vector_store
from app.services.query import run_query

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models for the /query endpoint
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str
    document_id: Optional[str] = None


class Citation(BaseModel):
    chunk_text: str
    filename: str
    page: int
    chunk_index: int


class QueryResponse(BaseModel):
    answer: str
    citations: List[Citation]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Endpoint to upload a PDF document and ingest it into the RAG pipeline.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
        
    try:
        file_bytes = await file.read()
        result = ingest_pdf(file_bytes, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/documents")
def list_documents():
    """
    Endpoint to list all ingested documents and their corresponding chunk counts.
    """
    try:
        documents = vector_store.get_all_documents()
        return {"documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query", response_model=QueryResponse)
def query_document(request: QueryRequest):
    """
    Endpoint to ask a question against the ingested documents.

    Accepts a question (and optionally a document_id to scope the search),
    retrieves the most relevant chunks, generates a grounded answer using
    an LLM, and returns the answer with citations mapped back to source chunks.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = run_query(
            question=request.question,
            document_id=request.document_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

