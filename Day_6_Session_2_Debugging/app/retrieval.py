from app.config import TOP_K, DEBUG_MODE
from app.embeddings import embed_query
from app.vector_store import get_chroma_client, get_or_create_collection

def retrieve(question: str, top_k: int = TOP_K) -> list:
    """
    Retrieves the top_k most similar document chunks from the ChromaDB collection.
    
    Args:
        question (str): The search query.
        top_k (int): Number of results to retrieve.
        
    Returns:
        list of dict: The retrieved chunks containing 'chunk_id', 'text', 'metadata',
                      'distance', and 'similarity'.
    """
    if not question.strip():
        raise ValueError("Question cannot be empty or whitespace only.")

    # 1. Generate query embedding
    query_emb = embed_query(question)

    # 2. Query ChromaDB collection
    client = get_chroma_client()
    collection = get_or_create_collection(client)

    results = collection.query(
        query_embeddings=[query_emb],
        n_results=top_k
    )

    retrieved_chunks = []

    # ChromaDB structures returns as lists of lists (to handle batch queries)
    if results and "documents" in results and results["documents"] and results["documents"][0]:
        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]
        ids = results["ids"][0]

        for i in range(len(documents)):
            dist = distances[i]
            # BUG #2: Reversed similarity calculation
            # Cosine Distance = 1.0 - Cosine Similarity
            # Therefore: Similarity = 1.0 - Distance
            similarity =   1.0-dist# BUG: Should be 1.0 - dist

            retrieved_chunks.append({
                "chunk_id": ids[i],
                "text": documents[i],
                "metadata": metadatas[i],
                "distance": dist,
                "similarity": similarity
            })

    return retrieved_chunks

def debug_retrieval(question: str):
    """
    Retrieves chunks for a query and displays detailed debug logs mapping out
    distances and similarity computations.
    """
    retrieved = retrieve(question)

    print("\n==============================")
    print("RAG RETRIEVAL DEBUG")
    print("==============================")
    print(f"QUESTION:\n{question}\n")

    if not retrieved:
        print("NO RESULTS RETRIEVED. Database might be empty or uninitialized.")
        print("==============================\n")
        return

    for idx, chunk in enumerate(retrieved):
        print(f"RESULT {idx + 1}")
        print(f"Document:   {chunk['metadata'].get('document', 'Unknown')}")
        print(f"Chunk ID:   {chunk['chunk_id']}")
        print(f"Distance:   {chunk['distance']:.6f}")
        print(f"Similarity: {chunk['similarity']:.6f} (Calculated as 1 - Cosine Distance)")
        print("\nChunk:")
        print(chunk['text'].strip())
        print("-" * 30)
        print()
    print("==============================\n")
