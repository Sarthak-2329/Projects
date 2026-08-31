from sentence_transformers import SentenceTransformer
from typing import List

# We use all-MiniLM-L6-v2 as requested. It generates 384-dimensional embeddings.
# It runs fully locally and doesn't require any API keys.
MODEL_NAME = "all-MiniLM-L6-v2"
model = None

def get_model():
    """Lazy load the model to avoid slow startup times if not needed immediately."""
    global model
    if model is None:
        model = SentenceTransformer(MODEL_NAME)
    return model

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Takes a list of string chunks and returns a list of embeddings.
    """
    if not texts:
        return []
        
    embedder = get_model()
    # The encode method returns a numpy array, we convert it to a list of lists of floats for ChromaDB
    embeddings = embedder.encode(texts)
    return embeddings.tolist()
