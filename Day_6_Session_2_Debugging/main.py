#!/usr/bin/env python3
"""
Main script to demonstrate the complete RAG pipeline end-to-end.
Runs all stages: document loading, chunking, embedding, retrieval, and LLM generation.
"""

import sys
import os

# Add current directory to path to enable imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import DEBUG_MODE, GEMINI_API_KEY
from app.vector_store import populate_vector_store
from app.rag import rag


def initialize_system():
    """Initialize and populate the vector store with knowledge base documents."""
    print("\n" + "=" * 60)
    print("RAG SYSTEM INITIALIZATION")
    print("=" * 60)
    
    if not GEMINI_API_KEY or GEMINI_API_KEY == "your_gemini_api_key_here":
        print("\n⚠️  WARNING: GEMINI_API_KEY is not configured!")
        print("Please update your .env file with a valid Gemini API key from:")
        print("https://aistudio.google.com/app/apikey")
        print("\nThe retrieval and chunking will work, but LLM generation will fail.")
    else:
        print("✓ GEMINI_API_KEY is configured")
    
    print(f"✓ DEBUG_MODE is: {DEBUG_MODE}")
    
    print("\nPopulating vector store with knowledge base documents...")
    populate_vector_store()
    print("\n✓ System initialization complete!")


def run_demo_questions():
    """Run a set of demo questions through the RAG pipeline."""
    print("\n" + "=" * 60)
    print("RAG DEMONSTRATION - RUNNING SAMPLE QUERIES")
    print("=" * 60)
    
    demo_questions = [
        "What is the annual leave policy?",
        "How many days of leave do employees get?",
        "What are the work from home guidelines?",
        "What is our travel policy?"
    ]
    
    for i, question in enumerate(demo_questions, 1):
        print(f"\n{'#' * 60}")
        print(f"QUERY #{i}: {question}")
        print(f"{'#' * 60}")
        
        try:
            answer = rag(question)
            print(f"\n✓ ANSWER RECEIVED:\n{answer}\n")
        except ValueError as e:
            print(f"✗ Validation Error: {e}")
        except RuntimeError as e:
            print(f"✗ LLM Error: {e}")
        except Exception as e:
            print(f"✗ Error: {type(e).__name__}: {e}")


def interactive_mode():
    """Run the RAG system in interactive mode."""
    print("\n" + "=" * 60)
    print("RAG INTERACTIVE MODE")
    print("=" * 60)
    print("\nEnter your questions (type 'exit' to quit):\n")
    
    while True:
        try:
            question = input("Q: ").strip()
            
            if question.lower() in ["exit", "quit", "q"]:
                print("\nThank you for using RAG! Goodbye.")
                break
            
            if not question:
                print("Please enter a valid question.\n")
                continue
            
            print("\nProcessing...")
            answer = rag(question)
            print(f"\nA: {answer}\n")
            print("-" * 60 + "\n")
            
        except ValueError as e:
            print(f"✗ Error: {e}\n")
        except RuntimeError as e:
            print(f"✗ Error: {e}\n")
        except KeyboardInterrupt:
            print("\n\nInterrupted. Goodbye.")
            break
        except Exception as e:
            print(f"✗ Unexpected error: {type(e).__name__}: {e}\n")


def main():
    """Main entry point for the RAG system."""
    if len(sys.argv) < 2:
        print("\nUsage: python main.py <command> [options]")
        print("\nCommands:")
        print("  setup         - Initialize vector store with documents")
        print("  demo          - Run demo questions through the pipeline")
        print("  interactive   - Start interactive mode")
        print("  all           - Run setup + demo (default)")
        print("\nExample:")
        print("  python main.py setup")
        print("  python main.py interactive")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "setup":
        initialize_system()
    elif command == "demo":
        run_demo_questions()
    elif command == "interactive":
        initialize_system()
        interactive_mode()
    elif command == "all":
        initialize_system()
        run_demo_questions()
    else:
        print(f"Unknown command: {command}")
        print("Valid commands: setup, demo, interactive, all")
        sys.exit(1)


if __name__ == "__main__":
    main()
