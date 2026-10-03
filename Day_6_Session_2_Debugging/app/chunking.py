from app.config import CHUNK_SIZE, CHUNK_OVERLAP

def chunk_document(doc, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
    """
    Splits a single document content into overlapping character-based chunks.
    
    Args:
        doc (dict): Document with 'document_name' and 'content' keys.
        chunk_size (int): Number of characters in each chunk.
        chunk_overlap (int): Number of characters overlapping between chunks.
        
    Returns:
        list of dict: List of chunks containing 'chunk_id', 'text', and 'metadata'.
    """
    content = doc["content"]
    doc_name = doc["document_name"]
    chunks = []
    
    if not content.strip():
        return chunks
        
    step = chunk_size - chunk_overlap
    if step <= 0:
        raise ValueError("chunk_overlap must be strictly less than chunk_size")
        
    chunk_index = 0
    start = 0
    
    while start < len(content):
        end = min(start + chunk_size, len(content))
        chunk_text = content[start:end]
        
        chunks.append({
            "chunk_id": f"{doc_name}_chunk_{chunk_index}",
            "text": chunk_text,
            "metadata": {
                "document": doc_name,
                "chunk_id": chunk_index
            }
        })
        
        chunk_index += 1 ## Runtime Error : Chunk_Index is not incremented. 
        if end >= len(content):
            break
        start += step
        
    return chunks

def create_chunks(docs, chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP):
    """
    Iterates over a list of documents and chunks each one of them.
    
    Returns:
        list of dict: Combined list of all chunks.
    """
    all_chunks = []
    for doc in docs:
        all_chunks.extend(chunk_document(doc, chunk_size, chunk_overlap))
    return all_chunks

def print_chunks(chunks, num_to_print=5):
    """
    Helper function to inspect chunks in detail.
    """
    print(f"\n=== CHUNK INSPECTOR (Total: {len(chunks)}, showing first {min(num_to_print, len(chunks))}) ===")
    for i, chunk in enumerate(chunks[:num_to_print]):
        print(f"\n[{i+1}] Chunk ID: {chunk['chunk_id']}")
        print(f"    Document Source: {chunk['metadata']['document']}")
        print(f"    Chunk Index:     {chunk['metadata']['chunk_id']}")
        print(f"    Character Count: {len(chunk['text'])}")
        print("    Content Preview:")
        print("    " + "-" * 50)
        # indent lines
        lines = chunk['text'].strip().split('\n')
        for line in lines[:4]:
            print(f"      {line}")
        if len(lines) > 4:
            print("      ...")
        print("    " + "-" * 50)
