import pytest
from app.chunking import chunk_document, create_chunks

def test_chunk_document_basic():
    doc = {
        "document_name": "test_policy.md",
        "content": "This is a test policy content to check chunking behavior. Let's make sure it splits correctly."
    }
    # Split with size=30 and overlap=10
    chunks = chunk_document(doc, chunk_size=30, chunk_overlap=10)
    
    assert len(chunks) > 0
    for chunk in chunks:
        assert "chunk_id" in chunk
        assert "text" in chunk
        assert "metadata" in chunk
        assert chunk["metadata"]["document"] == "test_policy.md"
        assert isinstance(chunk["metadata"]["chunk_id"], int)
        assert len(chunk["text"]) <= 30

def test_chunk_document_empty():
    doc = {
        "document_name": "empty.md",
        "content": "   "
    }
    chunks = chunk_document(doc, chunk_size=100, chunk_overlap=20)
    assert len(chunks) == 0

def test_create_chunks():
    docs = [
        {"document_name": "doc1.md", "content": "Content of document one is here."},
        {"document_name": "doc2.md", "content": "Content of document two is also here."}
    ]
    chunks = create_chunks(docs, chunk_size=20, chunk_overlap=5)
    assert len(chunks) >= 2
    
    doc_names = [c["metadata"]["document"] for c in chunks]
    assert "doc1.md" in doc_names
    assert "doc2.md" in doc_names
