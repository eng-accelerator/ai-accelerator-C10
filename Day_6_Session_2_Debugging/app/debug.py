from app.documents import load_documents
from app.chunking import create_chunks
from app.embeddings import embed_chunks, embed_query
from app.retrieval import retrieve, debug_retrieval
from app.context import build_context, inspect_context
from app.prompt import build_prompt, debug_prompt
from app.llm import generate_answer

def debug_documents():
    """
    Loads all raw documents from the knowledge base and prints their details.
    """
    print("\n==============================")
    print("DEBUG STAGE: DOCUMENT LOADING")
    print("==============================")
    docs = load_documents()
    print(f"Total documents found: {len(docs)}")
    for idx, doc in enumerate(docs):
        print(f"\n[{idx + 1}] Document ID: {doc['document_id']}")
        print(f"    Name:       {doc['document_name']}")
        print(f"    Length:     {len(doc['content'])} characters")
        print("    Preview:")
        preview = doc['content'].strip()[:150].replace('\n', ' ')
        print(f"      \"{preview}...\"")
    print("==============================\n")

def debug_chunks(num_to_print=3):
    """
    Loads and chunks documents, showing how text splits and what metadata gets attached.
    """
    print("\n==============================")
    print("DEBUG STAGE: CHUNKING & METADATA")
    print("==============================")
    docs = load_documents()
    chunks = create_chunks(docs)
    print(f"Total chunks created: {len(chunks)}")
    
    for idx, chunk in enumerate(chunks[:num_to_print]):
        print(f"\nChunk #{idx + 1}")
        print(f"  Chunk ID: {chunk['chunk_id']}")
        print(f"  Metadata: {chunk['metadata']}")
        print(f"  Text Length: {len(chunk['text'])} characters")
        print("  Text Snippet:")
        print("  " + "-" * 40)
        lines = chunk['text'].strip().split('\n')
        for line in lines[:4]:
            print(f"    {line}")
        if len(lines) > 4:
            print("    ...")
        print("  " + "-" * 40)
        
    if len(chunks) > num_to_print:
        print(f"\n... (Showing {num_to_print} out of {len(chunks)} total chunks)")
    print("==============================\n")

def debug_context(question: str):
    """
    Shows how retrieved chunks are parsed and merged into a single context string.
    """
    print("\n==============================")
    print("DEBUG STAGE: CONTEXT CONSTRUCTION")
    print("==============================")
    print(f"Query: {question}")
    retrieved = retrieve(question)
    context = build_context(retrieved)
    inspect_context(context)
    print("==============================\n")

def debug_response(question: str):
    """
    Runs the LLM query phase and prints the raw final output.
    """
    print("\n==============================")
    print("DEBUG STAGE: LLM RESPONSE")
    print("==============================")
    retrieved = retrieve(question)
    context = build_context(retrieved)
    prompt = build_prompt(question, context)
    print(f"QUESTION: {question}")
    try:
        response = generate_answer(prompt)
        print("\nRESPONSE:")
        print("-" * 50)
        print(response.strip())
        print("-" * 50)
    except Exception as e:
        print(f"\nLLM Call Failed: {e}")
    print("==============================\n")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Acme Corp RAG Step Debugger")
    parser.add_argument("--stage", choices=["docs", "chunks", "retrieval", "context", "prompt", "response"], 
                        required=True, help="RAG stage to debug")
    parser.add_argument("--query", type=str, default="How many annual leaves do employees receive?",
                        help="Question to query for retrieval, context, prompt, or response stages")
    args = parser.parse_args()

    if args.stage == "docs":
        debug_documents()
    elif args.stage == "chunks":
        debug_chunks()
    elif args.stage == "retrieval":
        debug_retrieval(args.query)
    elif args.stage == "context":
        debug_context(args.query)
    elif args.stage == "prompt":
        # Get retrieval and context first
        ret = retrieve(args.query)
        ctx = build_context(ret)
        debug_prompt(args.query, ctx)
    elif args.stage == "response":
        debug_response(args.query)
