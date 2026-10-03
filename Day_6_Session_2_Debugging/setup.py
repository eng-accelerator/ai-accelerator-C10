#!/usr/bin/env python3
"""
Setup script to initialize the RAG system for testing.
This script:
1. Checks dependencies
2. Populates the vector store
3. Validates the system is ready
"""

import sys
import os
import subprocess
from pathlib import Path

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def check_python_version():
    """Check Python version is 3.8+."""
    print("Checking Python version...")
    if sys.version_info < (3, 8):
        print(f"[FAIL] Python 3.8+ required, but you have {sys.version}")
        sys.exit(1)
    print(f"[OK] Python {sys.version.split()[0]} detected")


def check_dependencies():
    """Check all required dependencies are installed."""
    print("\nChecking dependencies...")
    
    required_packages = {
        'chromadb': 'chromadb',
        'sentence_transformers': 'sentence-transformers',
        'google': 'google-genai',
        'dotenv': 'python-dotenv',
        'numpy': 'numpy',
        'pytest': 'pytest'
    }
    
    missing = []
    for import_name, package_name in required_packages.items():
        try:
            __import__(import_name)
            print(f"[OK] {package_name}")
        except ImportError:
            print(f"[FAIL] {package_name} - MISSING")
            missing.append(package_name)
    
    if missing:
        print(f"\n[FAIL] Missing packages: {', '.join(missing)}")
        print("\nInstall with:")
        print(f"  pip install -r requirements.txt")
        sys.exit(1)
    
    print("\n[OK] All dependencies installed")


def check_knowledge_base():
    """Verify knowledge base documents exist."""
    print("\nChecking knowledge base...")
    
    kb_dir = Path(__file__).parent / "knowledge_base"
    if not kb_dir.exists():
        print(f"[FAIL] Knowledge base directory not found: {kb_dir}")
        sys.exit(1)
    
    md_files = list(kb_dir.glob("*.md"))
    if not md_files:
        print(f"[FAIL] No markdown files found in {kb_dir}")
        sys.exit(1)
    
    print(f"[OK] Knowledge base found with {len(md_files)} documents:")
    for f in sorted(md_files):
        size = f.stat().st_size
        print(f"  - {f.name} ({size} bytes)")


def check_env_file():
    """Check if .env file exists and has required settings."""
    print("\nChecking configuration...")
    
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        print(f"[FAIL] .env file not found: {env_file}")
        print("\nCreate it from .env.example:")
        print("  cp .env.example .env")
        sys.exit(1)
    
    print(f"[OK] .env file found")
    
    # Check for GEMINI_API_KEY
    with open(env_file, 'r') as f:
        content = f.read()
        if "your_gemini_api_key_here" in content or not "GEMINI_API_KEY=" in content:
            print("[WARN] GEMINI_API_KEY not configured in .env")
            print("       Get one at: https://aistudio.google.com/app/apikey")
        else:
            print("[OK] GEMINI_API_KEY is configured")


def initialize_vector_store():
    """Populate the vector store with documents."""
    print("\nInitializing vector store...")
    
    try:
        from app.vector_store import populate_vector_store
        populate_vector_store()
        print("[OK] Vector store initialized successfully")
    except Exception as e:
        print(f"[FAIL] Error initializing vector store: {e}")
        raise


def run_basic_tests():
    """Run basic tests to verify system functionality."""
    print("\nRunning basic validation tests...")
    
    try:
        from app.documents import load_documents
        from app.chunking import create_chunks
        from app.embeddings import embed_query
        from app.retrieval import retrieve
        
        # Test 1: Document loading
        docs = load_documents()
        assert len(docs) > 0, "No documents loaded"
        print(f"[OK] Document loading: {len(docs)} documents")
        
        # Test 2: Chunking
        chunks = create_chunks(docs)
        assert len(chunks) > 0, "No chunks created"
        print(f"[OK] Chunking: {len(chunks)} chunks")
        
        # Test 3: Embedding
        query_emb = embed_query("What is the leave policy?")
        assert len(query_emb) > 0, "Query embedding failed"
        print(f"[OK] Query embedding: {len(query_emb)} dimensions")
        
        # Test 4: Retrieval
        retrieved = retrieve("What is the leave policy?", top_k=3)
        assert len(retrieved) > 0, "No documents retrieved"
        print(f"[OK] Retrieval: {len(retrieved)} documents found")
        
    except Exception as e:
        print(f"✗ Validation test failed: {e}")
        raise


def main():
    """Run all setup steps."""
    print("\n" + "=" * 60)
    print("RAG SYSTEM SETUP & VALIDATION")
    print("=" * 60)
    
    try:
        check_python_version()
        check_dependencies()
        check_knowledge_base()
        check_env_file()
        initialize_vector_store()
        run_basic_tests()
        
        print("\n" + "=" * 60)
        print("[SUCCESS] SETUP COMPLETE!")
        print("=" * 60)
        print("\nYou can now run the RAG system:")
        print("  python main.py demo       # Run demo questions")
        print("  python main.py interactive # Interactive mode")
        print("\nOr run tests:")
        print("  pytest tests/ -v")
        print()
        
    except KeyboardInterrupt:
        print("\n\n[FAIL] Setup interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n[FAIL] Setup failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
