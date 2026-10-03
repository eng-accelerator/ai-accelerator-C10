import os
from app.config import KNOWLEDGE_BASE_DIR

def load_documents(directory=KNOWLEDGE_BASE_DIR):
    """
    Loads all markdown (.md) files from the specified knowledge base directory.
    
    Returns:
        list of dict: Each dict contains keys 'document_id', 'document_name', and 'content'.
    """
    documents = []
    if not os.path.exists(directory):
        print(f"[Document Loader] Warning: Directory {directory} does not exist.")
        return documents

    for filename in sorted(os.listdir(directory)):
        if filename.endswith(".md"):
            filepath = os.path.join(directory, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                documents.append({
                    "document_id": filename,  # simple, readable identifier
                    "document_name": filename,
                    "content": content
                })
            except Exception as e:
                print(f"[Document Loader] Error loading {filename}: {e}")
                
    return documents
