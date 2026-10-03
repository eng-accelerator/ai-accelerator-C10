import os
import chromadb
from app.config import CHROMADB_PATH, DEBUG_MODE

COLLECTION_NAME = "acme_policies"

def get_chroma_client():
    """
    Returns a Persistent ChromaDB client.
    """
    return chromadb.PersistentClient(path=CHROMADB_PATH)

def get_or_create_collection(client=None, collection_name=COLLECTION_NAME):
    """
    Retrieves or creates the policy collection.
    Note: We generate embeddings manually in our pipeline to make the Embeddings 
    stage visible, so we do not configure a default Chroma embedding function.
    """
    if client is None:
        client = get_chroma_client()
    
    # We configure 'hnsw:space' to 'cosine' so distances reflect Cosine distance
    return client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

def add_chunks_to_vector_store(chunks, client=None, collection_name=COLLECTION_NAME):
    """
    Saves embedded chunks containing 'chunk_id', 'text', 'metadata', and 'embedding'
    into ChromaDB.
    """
    if not chunks:
        if DEBUG_MODE:
            print("[Vector Store] No chunks to add.")
        return

    if client is None:
        client = get_chroma_client()

    collection = get_or_create_collection(client, collection_name)

    ids = [chunk["chunk_id"] for chunk in chunks]
    embeddings = [chunk["embedding"] for chunk in chunks]
    documents = [chunk["text"] for chunk in chunks]
    metadatas = [chunk["metadata"] for chunk in chunks]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )

    if DEBUG_MODE:
        print(f"[Vector Store] Added {len(chunks)} chunks to collection '{collection_name}'.")

def reset_vector_store(client=None, collection_name=COLLECTION_NAME):
    """
    Deletes and recreates the ChromaDB collection. Helpful for starting with
    a clean slate or introducing stale knowledge base bugs.
    """
    if client is None:
        client = get_chroma_client()

    try:
        client.delete_collection(name=collection_name)
        if DEBUG_MODE:
            print(f"[Vector Store] Deleted collection '{collection_name}' successfully.")
    except Exception as e:
        if DEBUG_MODE:
            print(f"[Vector Store] Collection deletion info: {e}")

    # Recreate the clean collection
    get_or_create_collection(client, collection_name)
    if DEBUG_MODE:
        print(f"[Vector Store] Initialized a fresh, empty collection '{collection_name}'.")

def populate_vector_store():
    """
    Orchestrates the entire ingestion process:
    1. Loads Markdown documents
    2. Chunks documents
    3. Computes embeddings
    4. Resets the Vector Store and saves chunks
    """
    print("\n--- INGESTION PIPELINE START ---")
    
    from app.documents import load_documents
    from app.chunking import create_chunks
    from app.embeddings import embed_chunks

    print("[Step 1/4] Loading documents...")
    docs = load_documents()
    print(f"Loaded {len(docs)} documents.")

    print("[Step 2/4] Splitting documents into chunks...")
    chunks = create_chunks(docs)
    print(f"Created {len(chunks)} chunks.")

    print("[Step 3/4] Generating vector embeddings...")
    embedded_chunks = embed_chunks(chunks)

    print("[Step 4/4] Uploading to ChromaDB...")
    reset_vector_store()
    add_chunks_to_vector_store(embedded_chunks)
    
    print("--- INGESTION PIPELINE COMPLETE ---\n")

if __name__ == "__main__":
    populate_vector_store()
