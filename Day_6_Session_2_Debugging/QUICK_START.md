# 🚀 RAG Debugging Lab - Complete Setup Guide

Welcome to the RAG Debugging Lab! This guide will help you get started and understand what's been set up.

## ✅ What Has Been Completed

### 1. **Complete RAG Pipeline** ✓
- Document loading from markdown files
- Text chunking with overlap
- Vector embeddings using SentenceTransformer
- ChromaDB vector store integration
- Semantic retrieval
- LLM integration with Gemini API

### 2. **Full Infrastructure** ✓
- `main.py` - Main entry point with demo and interactive modes
- `setup.py` - Comprehensive setup and validation script
- `.env` - Configuration file
- `README.md` - Complete documentation
- `DEBUGGING_GUIDE.md` - Detailed bug descriptions and debugging strategies

### 3. **Intentional Bugs Introduced** ✓
Five strategic bugs for learning debugging:
- Bug #1: Similarity calculation (negative values)
- Bug #2: Context formatting (missing separators)
- Bug #3: Empty retrieval handling
- Bug #4: Embedding type mismatch (tuple vs list)
- Bug #5: Missing context in LLM prompt

### 4. **Complete Knowledge Base** ✓
Five sample company policy documents:
- `benefits_policy.md`
- `expense_policy.md`
- `leave_policy.md`
- `travel_policy.md`
- `wfh_policy.md`

### 5. **Test Suite** ✓
- `tests/test_chunking.py` - Chunking validation
- `tests/test_rag.py` - RAG pipeline tests
- `tests/test_retrieval.py` - Retrieval tests

## 🎯 Quick Start - Three Steps

### Step 1: Configure Your API Key
Edit `.env` and add your Gemini API key:
```bash
# Get a free key at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_key_here
DEBUG_MODE=True
```

### Step 2: Run Setup (You'll See a Bug!)
```bash
python setup.py
```
**Expected:** The setup will fail with a JSON serialization error. This is Bug #4 - perfect for debugging!

### Step 3: Try Other Commands
Once you've fixed the bugs:
```bash
# Interactive mode
python main.py interactive

# Run demo questions
python main.py demo

# Run tests
pytest tests/ -v
```

## 🐛 The Bugs Explained

### Bug #1: Similarity Calculation (retrieval.py)
```python
# WRONG
similarity = dist - 1.0  # Creates negative numbers

# CORRECT  
similarity = 1.0 - dist  # Range: 0-1
```

### Bug #2: Context Formatting (context.py)
```python
# WRONG
return "".join(blocks)  # No separation between chunks

# CORRECT
return "\n\n".join(blocks)  # Clear separation
```

### Bug #3: Empty Retrieval (rag.py)
```python
# MISSING: No check for empty results
if not retrieved_chunks:
    raise ValueError("No relevant documents found")
```

### Bug #4: Embedding Type (embeddings.py)
```python
# WRONG
chunk["embedding"] = tuple(emb)  # ChromaDB expects list

# CORRECT
chunk["embedding"] = emb.tolist()  # Convert to list
```

### Bug #5: Missing Context (prompt.py)
```python
# WRONG - Context not in prompt
f"""QUESTION: {question}"""

# CORRECT - Include context
f"""CONTEXT: {context}

QUESTION: {question}"""
```

## 🔍 Debugging Workflow

### Option 1: Manual Debugging
1. Read `DEBUGGING_GUIDE.md` for detailed bug descriptions
2. Examine the code and find the issue
3. Use print statements to understand the problem
4. Fix the bug
5. Test with `pytest tests/ -v`

### Option 2: Use GitHub Copilot
1. Paste an error message: "Help me debug this: [error]"
2. Ask specific questions: "What's wrong with similarity calculation?"
3. Request fixes: "How do I fix this JSON error?"
4. Use debug traces: Paste trace output and ask "What's wrong here?"

### Option 3: Hybrid Approach (Recommended)
1. Run the system and observe errors
2. Check debug output in console
3. Ask Copilot: "Analyze this [paste relevant part of code/output]"
4. Iterate until fixed

## 📊 System Architecture

```
User Question
    ↓
[1. Query Embedding] → Convert text to 384-dim vector
    ↓
[2. Retrieval] → Find top-3 similar chunks in ChromaDB
    ↓
[3. Context Building] → Format chunks into readable context
    ↓
[4. Prompt Construction] → Create instruction for LLM
    ↓
[5. LLM Generation] → Call Gemini API
    ↓
Answer
```

Each stage has debug output when `DEBUG_MODE=True`

## 🧪 Testing Strategy

### Run All Tests
```bash
pytest tests/ -v
```

### Test Specific Bug
```bash
# Test retrieval (bugs #1, #4)
pytest tests/test_retrieval.py -v

# Test RAG pipeline (bugs #3, #5)
pytest tests/test_rag.py -v

# Test chunking (no bugs)
pytest tests/test_chunking.py -v
```

### Debug Specific Module
```python
# In Python shell
from app.debug import debug_documents
debug_documents()

from app.retrieval import debug_retrieval
debug_retrieval("What is the annual leave policy?")

from app.context import inspect_context
from app.debug import debug_context
```

## 📁 File Structure

```
rag-debugging-lab/
├── main.py                 # Entry point (setup/demo/interactive)
├── setup.py                # Setup & validation script
├── README.md               # Full documentation
├── DEBUGGING_GUIDE.md      # Bug descriptions & strategies
├── QUICK_START.md          # This file
├── .env                    # Configuration (API key)
├── requirements.txt        # Python dependencies
├── app/                    # Core RAG pipeline
│   ├── documents.py        # Load markdown documents
│   ├── chunking.py         # Split into chunks
│   ├── embeddings.py       # Generate embeddings [Bug #4]
│   ├── vector_store.py     # ChromaDB integration
│   ├── retrieval.py        # Semantic search [Bug #1]
│   ├── context.py          # Format context [Bug #2]
│   ├── prompt.py           # Build LLM prompt [Bug #5]
│   ├── rag.py              # Main pipeline [Bug #3]
│   ├── llm.py              # LLM generation
│   ├── config.py           # Configuration
│   └── debug.py            # Debug utilities
├── tests/                  # Test suite
│   ├── test_chunking.py
│   ├── test_retrieval.py
│   └── test_rag.py
├── knowledge_base/         # Sample documents
│   ├── benefits_policy.md
│   ├── expense_policy.md
│   ├── leave_policy.md
│   ├── travel_policy.md
│   └── wfh_policy.md
└── chroma_db/              # Vector database (auto-created)
```

## 🚀 Running the System

### 1. Setup Only (Initialize Vector Store)
```bash
python main.py setup
```
**Note:** Will fail with Bug #4 error - that's where you start debugging!

### 2. Interactive Mode
```bash
python main.py interactive
```
Ask questions about company policies:
- "What is the annual leave policy?"
- "How many days vacation do I get?"
- "What is the work from home policy?"

### 3. Demo Mode
```bash
python main.py demo
```
Runs 4 pre-defined questions and shows the pipeline in action.

### 4. All at Once
```bash
python main.py all
```
Setup + demo in one command.

## 🎓 Learning Goals

After debugging this system, you'll understand:

✅ How RAG systems work end-to-end  
✅ Vector embeddings and similarity search  
✅ Semantic retrieval basics  
✅ LLM prompt engineering  
✅ Common bugs in ML systems  
✅ How to debug with AI assistance  
✅ ChromaDB operations  
✅ Python best practices  

## 💡 Tips for Debugging

1. **Start with `python setup.py`** - It will fail and show you the first bug
2. **Read debug output carefully** - Each stage prints its output when DEBUG_MODE=True
3. **Use `pytest -v`** - Tests provide clear pass/fail indicators
4. **Ask Copilot specific questions** - "Why is X wrong?" gets better answers than "fix it"
5. **Test one fix at a time** - Fix one bug, run tests, move to next
6. **Check console output** - Lots of helpful debug info printed there

## 🔧 Useful Commands

```bash
# Setup and validation
python setup.py

# Run the system
python main.py demo
python main.py interactive

# Test suite
pytest tests/ -v
pytest tests/test_rag.py::test_rag_end_to_end_answering -v

# Debug specific module
python -c "from app.debug import debug_documents; debug_documents()"
python -c "from app.retrieval import debug_retrieval; debug_retrieval('leave')"

# Clear vector store and restart
rm -r chroma_db/  # Linux/Mac
rmdir /s chroma_db  # Windows
python setup.py
```

## ❓ Troubleshooting

### "ModuleNotFoundError" or "No module named..."
```bash
pip install -r requirements.txt
```

### "GEMINI_API_KEY is not configured"
Edit `.env`:
```env
GEMINI_API_KEY=your_key_from_aistudio.google.com
```

### "No documents found"
Check `knowledge_base/` exists with `.md` files:
```bash
ls knowledge_base/
```

### ChromaDB errors
Clear and reinitialize:
```bash
rm -r chroma_db/
python setup.py
```

### Tests failing
Run in verbose mode to see what's wrong:
```bash
pytest tests/ -vv -s
```

## 🤖 Using Copilot Effectively

### Finding Bugs
```
"I'm getting this error: [paste error]
What's causing it?"

"Analyze this code for bugs:
[paste function]"

"My RAG pipeline isn't working. 
Debug this output:
[paste debug trace]"
```

### Fixing Bugs
```
"How do I fix: [error message]"

"The similarity calculation is wrong.
What should the formula be?"

"Complete this function correctly:
[paste function]"
```

### Understanding Code
```
"Explain what this function does:
[paste code]"

"Why would this cause JSON errors:
[paste code]"

"What's the best way to handle empty lists here:
[paste code]"
```

## 📚 References

- [ChromaDB Docs](https://docs.trychroma.com/)
- [Sentence Transformers](https://www.sbert.net/)
- [Gemini API](https://ai.google.dev/)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)
- [RAG Concept](https://en.wikipedia.org/wiki/Retrieval-augmented_generation)

## ✨ You're All Set!

Everything is ready for you to debug. The system is fully functional except for the intentional bugs. 

**Start here:** Run `python setup.py` and look for the first error - that's Bug #4!

---

**Happy debugging! Questions? Use GitHub Copilot to help guide you through the process.** 🎯🐛
