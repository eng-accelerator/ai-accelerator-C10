import pytest
from app.retrieval import retrieve

def test_retrieval_leave_policy():
    """
    Verify that query 'How many annual leaves do employees receive?' returns
    leave_policy.md as the top hit and contains the expected content.
    """
    question = "How many annual leaves do employees receive?"
    retrieved = retrieve(question, top_k=2)
    
    assert len(retrieved) > 0
    # Top result should be from the leave policy
    top_hit = retrieved[0]
    assert top_hit["metadata"]["document"] == "leave_policy.md"
    assert "distance" in top_hit
    assert "similarity" in top_hit
    # Should contain relevant keyword or number of days
    text = top_hit["text"].lower()
    assert "annual leave" in text or "24" in text
