def build_context(retrieved_chunks: list) -> str:
    """
    Constructs a structured context string from retrieved chunks.
    
    Args:
        retrieved_chunks (list of dict): Retrieved chunks with metadata and text.
        
    Returns:
        str: Formatted context blocks.
    """
    if not retrieved_chunks:
        return ""
        
    blocks = []
    for chunk in retrieved_chunks:
        doc_name = chunk["metadata"].get("document", "Unknown")
        text = chunk["text"].strip()
        blocks.append(f"[Document: {doc_name}]\n{text}")
    
    # BUG #3: Missing separator - should join with \n\n
    return "".join(blocks)  # BUG: Should be "\n\n".join(blocks)

def inspect_context(context: str):
    """
    Prints the constructed context block in a clean, inspectable format.
    """
    print("\n===== RETRIEVED CONTEXT =====")
    if not context.strip():
        print("[No context retrieved]")
    else:
        print(context)
    print("==============================\n")
