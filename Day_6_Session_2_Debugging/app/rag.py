import sys
from app.config import DEBUG_MODE, TOP_K
from app.embeddings import embed_query
from app.retrieval import retrieve
from app.context import build_context
from app.prompt import build_prompt
from app.llm import generate_answer

def rag(question: str) -> str:
    """
    Coordinates the complete end-to-end RAG pipeline:
    Question -> Query Embedding -> Retrieval -> Context Construction -> Prompt Construction -> Gemini -> Answer
    
    Args:
        question (str): User's question.
        
    Returns:
        str: Grounded response answer.
    """
    if not question.strip():
        raise ValueError("Question cannot be empty or whitespace only.")

    trace = {}
    answer = ""

    try:
        # 1. Query Embedding
        query_emb = embed_query(question)
        trace["query_embedding"] = "✓ Generated"

        # 2. Retrieval
        retrieved_chunks = retrieve(question, top_k=TOP_K)
        trace["retrieved_count"] = len(retrieved_chunks)
        if retrieved_chunks:
            trace["top_document"] = retrieved_chunks[0]["metadata"].get("document", "Unknown")
            top_text = retrieved_chunks[0]["text"].strip()
            # truncate preview for trace output clarity
            if len(top_text) > 120:
                top_text = top_text[:117] + "..."
            trace["top_result"] = top_text
        else:
            trace["top_document"] = "None"
            trace["top_result"] = "No chunks retrieved"

        # 3. Context Construction
        # BUG #4: No validation for empty retrieved_chunks
        context = build_context(retrieved_chunks)
        # BUG: Should check if len(retrieved_chunks) == 0 and handle appropriately
        trace["context"] = "✓ Generated"

        # 4. Prompt Construction
        prompt = build_prompt(question, context)
        trace["prompt"] = "✓ Generated"

        # 5. Gemini API Call
        answer = generate_answer(prompt)
        trace["llm"] = "✓ Called"
        
    except Exception as e:
        trace["error"] = str(e)
        if DEBUG_MODE:
            print_debug_trace(question, trace, status="ERROR", answer=None)
        raise e

    if DEBUG_MODE:
        print_debug_trace(question, trace, status="SUCCESS", answer=answer)

    return answer

def print_debug_trace(question: str, trace: dict, status: str, answer: str = None):
    """
    Prints a clean trace showing the outcome of each stage of the RAG pipeline.
    """
    print("\n========================================")
    print("RAG DEBUG TRACE")
    print("========================================")
    print(f"QUESTION:\n{question}\n")

    if "query_embedding" in trace:
        print(f"QUERY EMBEDDING:\n{trace['query_embedding']}\n")

    if "retrieved_count" in trace:
        print(f"RETRIEVAL:\n✓ {trace['retrieved_count']} chunks retrieved\n")

    if "top_document" in trace:
        print(f"TOP DOCUMENT:\n{trace['top_document']}\n")

    if "top_result" in trace:
        print(f"TOP RESULT:\n{trace['top_result']}\n")

    if "context" in trace:
        print(f"CONTEXT:\n{trace['context']}\n")

    if "prompt" in trace:
        print(f"PROMPT:\n{trace['prompt']}\n")

    if "llm" in trace:
        print(f"LLM:\n{trace['llm']}\n")

    if status == "ERROR":
        print("STATUS: FAILED ❌")
        print(f"ERROR DETAILS: {trace.get('error')}\n")
    else:
        print("STATUS: SUCCESS ✓")
        print(f"ANSWER:\n{answer.strip()}\n")
    print("========================================\n")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Acme Corp Company Policy RAG Assistant")
    parser.add_argument("question", nargs="?", type=str, help="Single question to run end-to-end")
    args = parser.parse_args()

    if args.question:
        try:
            rag(args.question)
        except Exception as e:
            sys.exit(1)
    else:
        # CLI Loop
        print("==================================================")
        print("Acme Corp Company Policy RAG Assistant (CLI Demo)")
        print("Type 'exit' or 'quit' to terminate the session.")
        print("==================================================")
        while True:
            try:
                user_input = input("\nEnter your question:\n> ")
                if user_input.strip().lower() in ["exit", "quit"]:
                    print("Exiting RAG assistant. Goodbye!")
                    break
                if not user_input.strip():
                    continue
                rag(user_input)
            except KeyboardInterrupt:
                print("\nExiting RAG assistant. Goodbye!")
                break
            except Exception as e:
                print(f"\nPipeline Error occurred: {e}")
