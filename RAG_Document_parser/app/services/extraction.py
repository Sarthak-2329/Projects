import pdfplumber
import io
from typing import List, Dict

def extract_text_from_pdf(file_bytes: bytes, filename: str) -> List[Dict[str, str]]:
    """
    Extracts text from a PDF file using pdfplumber.
    Returns a list of dictionaries, one per page.
    """
    extracted_pages = []
    
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                extracted_pages.append({
                    "page_number": i + 1,
                    "text": text,
                    "source": filename
                })
                
    return extracted_pages
