import os
import pytest
from httpx import AsyncClient, ASGITransport
from reportlab.pdfgen import canvas
import shutil

from main import app
from app.database.vector_store import CHROMA_DATA_PATH
from app.services.embedding import MODEL_NAME, get_model

# Dummy data for the PDF
TEST_PDF_NAME = "test_document.pdf"
TEST_TEXT = "This is a test sentence that is somewhat long so we can test the chunking behavior. " * 20 

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """
    Sets up the test environment by creating a dummy PDF and 
    cleaning up the ChromaDB directory before and after tests.
    """
    # Clear collection before test
    from app.services.ingestion import vector_store
    try:
        vector_store.client.delete_collection("documents")
    except Exception:
        pass
    vector_store.collection = vector_store.client.create_collection("documents")
        
    # Generate a dummy PDF using reportlab
    c = canvas.Canvas(TEST_PDF_NAME)
    c.drawString(100, 750, TEST_TEXT[:100]) # just need some text
    # A bit more text to ensure we get > 1 chunk
    textobject = c.beginText()
    textobject.setTextOrigin(10, 730)
    textobject.textLines(TEST_TEXT)
    c.drawText(textobject)
    c.showPage()
    # Add a second page
    c.drawString(100, 750, "Page 2 text.")
    c.showPage()
    c.save()
    
    yield
    
    # Teardown
    if os.path.exists(TEST_PDF_NAME):
        os.remove(TEST_PDF_NAME)
    try:
        vector_store.client.delete_collection("documents")
    except Exception:
        pass

@pytest.mark.asyncio
async def test_upload_and_ingest():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with open(TEST_PDF_NAME, "rb") as f:
            response = await ac.post("/upload", files={"file": (TEST_PDF_NAME, f, "application/pdf")})
        
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert data["document_id"] == TEST_PDF_NAME
        assert data["chunks_created"] > 0
        
        # We can also check embedding dimensions manually
        model = get_model()
        test_embedding = model.encode(["test"])
        assert len(test_embedding[0]) == 384, "Embedding dimensionality must be 384 for all-MiniLM-L6-v2"

@pytest.mark.asyncio
async def test_list_documents():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Re-upload to ensure data exists (if tests are run independently, though it's sequential by default)
        with open(TEST_PDF_NAME, "rb") as f:
            await ac.post("/upload", files={"file": (TEST_PDF_NAME, f, "application/pdf")})
            
        response = await ac.get("/documents")
        assert response.status_code == 200
        data = response.json()
        
        assert "documents" in data
        docs = data["documents"]
        assert len(docs) >= 1
        
        # Verify metadata extraction logic worked and grouping worked
        found_test_doc = False
        for doc in docs:
            if doc["document_id"] == TEST_PDF_NAME:
                found_test_doc = True
                assert doc["chunk_count"] > 0
                break
                
        assert found_test_doc, "The ingested document was not found in the /documents list."
