from typing import List, Dict, Any

def chunk_text(pages: List[Dict[str, str]], chunk_size: int = 500, overlap: int = 50) -> List[Dict[str, Any]]:
    """
    Takes extracted pages and splits them into overlapping chunks.
    
    Why use an overlap?
    When splitting text arbitrarily, a chunk boundary might cut a sentence or 
    idea in half. An overlap ensures that the context at the end of one chunk 
    is carried over to the beginning of the next chunk. This prevents the LLM 
    from losing important contextual connections across chunk boundaries.
    """
    chunks = []
    chunk_index = 0
    step = chunk_size - overlap
    
    # We ensure step is positive
    if step <= 0:
        raise ValueError("Overlap must be smaller than chunk size.")

    for page_data in pages:
        text = page_data["text"]
        source = page_data["source"]
        page_num = page_data["page_number"]
        
        # Iterate over the text string, advancing by 'step' each time
        for i in range(0, len(text), step):
            # Extract the chunk
            chunk_text = text[i:i + chunk_size]
            
            # Why store this specific metadata?
            # - source: to know which document this chunk belongs to (for grouping or filtering).
            # - page: crucial for citations in the final Q&A app so the user knows exactly where the answer came from.
            # - chunk_index: useful for reconstructing document order or fetching neighboring chunks for extended context.
            chunks.append({
                "chunk_id": f"{source}_p{page_num}_c{chunk_index}",
                "text": chunk_text,
                "metadata": {
                    "source": source,
                    "page": page_num,
                    "chunk_index": chunk_index
                }
            })
            chunk_index += 1
            
            # If the current chunk is smaller than chunk_size, we've reached the end of the text on this page.
            if len(chunk_text) < chunk_size:
                break
                
    return chunks
