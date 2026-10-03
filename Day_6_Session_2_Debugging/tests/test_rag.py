import os
import pytest
from app.rag import rag

def test_rag_empty_question_validation():
    """
    Ensure empty or whitespace-only questions are rejected with ValueError.
    """
    with pytest.raises(ValueError, match="Question cannot be empty"):
        rag("")
        
    with pytest.raises(ValueError, match="Question cannot be empty"):
        rag("   ")

def test_rag_end_to_end_answering():
    """
    Ensure the RAG pipeline correctly answers a leave policy question
    if the GEMINI_API_KEY is configured.
    """
    if not os.getenv("GEMINI_API_KEY"):
        pytest.skip("Skipping end-to-end RAG test: GEMINI_API_KEY is not set.")

    question = "How many annual leaves do employees receive?"
    answer = rag(question)
    
    assert len(answer.strip()) > 0
    # The LLM answer should mention 24 days based on leave_policy.md
    assert "24" in answer
