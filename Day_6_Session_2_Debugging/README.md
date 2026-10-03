# RAG Debugging Lab

A complete Retrieval-Augmented Generation (RAG) system for demonstrating debugging with AI.

## 🎯 Project Structure

- **`app/`** - Core RAG pipeline components
  - `documents.py` - Load markdown documents from knowledge base
  - `chunking.py` - Split documents into overlapping chunks
  - `embeddings.py` - Generate vector embeddings using SentenceTransformer
  - `vector_store.py` - Manage ChromaDB vector database
  - `retrieval.py` - Retrieve relevant chunks for queries
  - `context.py` - Build context from retrieved chunks
  - `prompt.py` - Construct prompts for LLM
  - `llm.py` - Generate answers using Gemini API
  - `rag.py` - Orchestrate the complete pipeline
  - `config.py` - Configuration management
  - `debug.py` - Debug utilities

- **`knowledge_base/`** - Sample company policy documents
  - `leave_policy.md` - Annual leave policy
  - `travel_policy.md` - Business travel guidelines
  - `work_from_home.md` - WFH policy
  - `benefits_policy.md` - Benefits information
  - `expense_policy.md` - Expense reimbursement policy

- **`chroma_db/`** - Vector database storage (auto-created)

- **`tests/`** - Test suite
  - `test_chunking.py` - Chunking validation
  - `test_rag.py` - RAG pipeline tests
  - `test_retrieval.py` - Retrieval tests

## 🚀 Quick Start

### 1. Setup
```bash
pip install -r requirements.txt
python setup.py
```

### 2. Configure API Key
Edit `.env` and add your Gemini API key from [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey):
```env
GEMINI_API_KEY=your_key_here
DEBUG_MODE=True
```

### 3. Run the System

**Setup only (initialize vector store):**
```bash
python main.py setup
```

**Run demo questions:**
```bash
python main.py demo
```

**Interactive mode:**
```bash
python main.py interactive
```

**Run all (setup + demo):**
```bash
python main.py all
```

## 🧪 Testing

Run the test suite:
```bash
pytest tests/ -v
```

Run specific test:
```bash
pytest tests/test_rag.py::test_rag_empty_question_validation -v
```

## 🐛 Intentional Bugs for Debugging Practice

The project includes several intentional bugs to practice debugging with AI. Here's what to look for:

### Bug #1: Similarity Calculation Error (retrieval.py)
**Location:** `app/retrieval.py` line ~45
**Issue:** The similarity calculation uses incorrect formula
**Impact:** Similarity scores may be negative or incorrect

### Bug #2: Wrong Chunk Order (retrieval.py)
**Location:** `app/retrieval.py` line ~40
**Issue:** Retrieved chunks are not sorted by relevance
**Impact:** Less relevant documents returned first

### Bug #3: Context Building Bug (context.py)
**Location:** `app/context.py` line ~15
**Issue:** Missing separator between context blocks
**Impact:** Context blocks are concatenated without clear separation

### Bug #4: Empty Context Handling (rag.py)
**Location:** `app/rag.py` line ~35
**Issue:** No validation for empty retrieved chunks
**Impact:** RAG pipeline doesn't handle zero-result queries gracefully

### Bug #5: API Key Validation (llm.py)
**Location:** `app/llm.py` line ~15
**Issue:** API key check is case-sensitive
**Impact:** Valid keys might be rejected based on case

## 🔍 Debugging Workflow

1. **Identify the bug** by running:
   ```bash
   python main.py demo
   ```
   
2. **Analyze debug traces** printed to console (DEBUG_MODE=True in .env)

3. **Use GitHub Copilot** to:
   - Ask "What's wrong with this output?"
   - Request "Find the bug in retrieval.py"
   - Use "Explain this error" for stack traces

4. **Verify the fix** by running tests:
   ```bash
   pytest tests/ -v
   ```

## 📊 System Architecture

```
User Question
      ↓
[Query Embedding] → Convert to vector
      ↓
[Retrieval] → Find similar chunks in ChromaDB
      ↓
[Context Building] → Format retrieved chunks
      ↓
[Prompt Construction] → Create LLM prompt
      ↓
[LLM Generation] → Call Gemini API
      ↓
Answer
```

## 🔧 Key Components Explained

### Embeddings
- Uses `sentence-transformers` (all-MiniLM-L6-v2)
- Converts text to 384-dimensional vectors
- Applied to both documents and queries

### Vector Store
- ChromaDB with persistent storage
- Cosine distance metric (0 = identical, 2 = opposite)
- Similarity = 1 - Distance

### Retrieval
- Finds top-K most similar chunks
- Returns metadata with each result
- Includes similarity scores

## 📝 Configuration

Edit `.env` to customize:
```env
# Gemini API Configuration
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash

# Debug output
DEBUG_MODE=True

# Retrieval
TOP_K=3

# Chunking
CHUNK_SIZE=300
CHUNK_OVERLAP=100

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

## 🤖 Using with GitHub Copilot

Try these prompts to find and fix bugs:

- "There's a bug in the RAG pipeline. Debug this output: [paste error]"
- "My retrieval is returning irrelevant results. What's wrong?"
- "The similarity scores look wrong. Can you check the math?"
- "Why isn't my context building correctly?"
- "Explain this error and how to fix it: [error message]"

## 📚 References

- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Sentence Transformers](https://www.sbert.net/)
- [Google Gemini API](https://ai.google.dev/)
- [RAG Concepts](https://en.wikipedia.org/wiki/Retrieval-augmented_generation)

## ✨ Features

✅ Complete RAG pipeline  
✅ Vector database integration  
✅ LLM integration  
✅ Debug tracing  
✅ Sample knowledge base  
✅ Test suite  
✅ Interactive mode  
✅ Intentional bugs for learning  

## 🎓 Learning Goals

After working through this lab, you'll understand:
- How RAG systems work end-to-end
- Vector embeddings and similarity search
- Prompt engineering
- LLM integration
- Debugging ML systems with AI assistance
- Writing effective prompts for code debugging

---

**Happy debugging! 🐛🔍**
