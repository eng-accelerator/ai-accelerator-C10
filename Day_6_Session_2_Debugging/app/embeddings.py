import numpy as np
from sentence_transformers import SentenceTransformer
from app.config import EMBEDDING_MODEL, DEBUG_MODE

# Lazy load the SentenceTransformer model
_model = None

def get_embedding_model():
    global _model
    if _model is None:
        if DEBUG_MODE:
            print(f"[Embeddings] Loading SentenceTransformer model '{EMBEDDING_MODEL}'...")
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model

def embed_text(text: str) -> np.ndarray:
    """
    Generates a dense vector embedding for a given text string.
    
    Returns:
        np.ndarray: The vector embedding.
    """
    model = get_embedding_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding

def embed_chunks(chunks: list) -> list:
    """
    Computes vector embeddings for a list of document chunks.
    Injects the embedding vector into each chunk dictionary under the 'embedding' key.
    
    Args:
        chunks (list of dict): List of chunk dictionaries.
        
    Returns:
        list of dict: The input list with each dictionary containing an 'embedding' key.
    """
    if not chunks:
        return chunks
        
    model = get_embedding_model()
    texts = [c["text"] for c in chunks]
    embeddings = model.encode(texts, convert_to_numpy=True)
    
    # Convert embeddings to list format for ChromaDB compatibility
    for chunk, emb in zip(chunks, embeddings):
        chunk["embedding"] = emb.tolist()
        
    if DEBUG_MODE:
        sample_emb = embeddings[0]
        print(f"\n==============================")
        print(f"EMBEDDINGS DEBUG INFO")
        print(f"==============================")
        print(f"Total Chunks Embedded: {len(chunks)}")
        print(f"Embedding Model:       {EMBEDDING_MODEL}")
        print(f"Embedding Shape:        {sample_emb.shape}")
        print(f"Embedding Dimension:    {len(sample_emb)}")
        print(f"First 5 Values:         {[round(float(x), 6) for x in sample_emb[:5]]}")
        print(f"==============================\n")
        
    return chunks

def embed_query(query: str) -> list:
    """
    Computes vector embedding for a single text query.
    
    Args:
        query (str): The search query.
        
    Returns:
        list: The embedding vector as a standard Python list.
    """
    emb = embed_text(query)
    return emb.tolist()
