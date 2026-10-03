# 🎯 RAG Debugging Lab - Setup Complete! 

## ✅ Your Project is Ready to Debug

Everything has been configured and intentional bugs have been introduced. You now have a complete, working RAG system with 5 strategic bugs to find and fix using AI assistance.

---

## 📋 What's Been Set Up

### ✨ Complete RAG Pipeline
```
Knowledge Base (5 documents)
       ↓
   Documents
       ↓
   Chunking (38 chunks)
       ↓
   Embeddings (384-dimensional vectors)
       ↓
   ChromaDB Vector Store
       ↓
   User Query
       ↓
   Query Embedding
       ↓
   Retrieval (Top-3 similar chunks)
       ↓
   Context Building
       ↓
   Prompt Construction
       ↓
   Gemini LLM API
       ↓
   Final Answer
```

### 📁 Project Structure
```
rag-debugging-lab/
├── 📄 Entry Points
│   ├── main.py          ← Run your system here
│   └── setup.py         ← Initialize everything
│
├── 📚 Core RAG Code
│   ├── app/documents.py     ← Load knowledge base
│   ├── app/chunking.py      ← Split documents
│   ├── app/embeddings.py    ← [BUG #4] Generate vectors
│   ├── app/retrieval.py     ← [BUG #1] Find similar chunks
│   ├── app/context.py       ← [BUG #2] Format retrieved docs
│   ├── app/prompt.py        ← [BUG #5] Build LLM prompt
│   ├── app/rag.py           ← [BUG #3] Orchestrate pipeline
│   └── app/llm.py           ← Call Gemini API
│
├── 📖 Documentation
│   ├── README.md             ← Full documentation
│   ├── QUICK_START.md        ← 3-step setup guide
│   ├── DEBUGGING_GUIDE.md    ← Bug descriptions & fixes
│   ├── COPILOT_PROMPTS.md   ← Ready-to-use Copilot prompts
│   ├── BUG_MAP.md            ← Visual bug locations
│   ├── PROGRESS_CHECKLIST.md ← Track your progress
│   └── SETUP_SUMMARY.md      ← What's been done
│
├── 🧪 Tests
│   ├── tests/test_chunking.py
│   ├── tests/test_retrieval.py
│   └── tests/test_rag.py
│
├── 📦 Knowledge Base
│   ├── knowledge_base/benefits_policy.md
│   ├── knowledge_base/expense_policy.md
│   ├── knowledge_base/leave_policy.md
│   ├── knowledge_base/travel_policy.md
│   └── knowledge_base/wfh_policy.md
│
└── ⚙️ Config Files
    ├── .env                 ← Your API key goes here
    ├── .env.example
    ├── requirements.txt
    └── .gitignore
```

---

## 🐛 The 5 Intentional Bugs

### Bug #1: Similarity Calculation 🔴 CRITICAL
**Location:** `app/retrieval.py` line 45  
**Problem:** `similarity = dist - 1.0` ← Produces negative values  
**Solution:** Should be `similarity = 1.0 - dist`  
**Impact:** Relevance ranking completely inverted  

### Bug #2: Context Formatting 🟡 MEDIUM  
**Location:** `app/context.py` line 18  
**Problem:** `return "".join(blocks)` ← No separator  
**Solution:** Should be `return "\n\n".join(blocks)`  
**Impact:** Document chunks run together  

### Bug #3: Empty Retrieval Check 🟡 MEDIUM
**Location:** `app/rag.py` line 29  
**Problem:** No validation for zero results  
**Solution:** Add `if not retrieved_chunks: raise ValueError(...)`  
**Impact:** False confidence in answers  

### Bug #4: Embedding Type Error 🔴 CRITICAL
**Location:** `app/embeddings.py` line 23  
**Problem:** `chunk["embedding"] = tuple(emb)` ← Wrong type  
**Solution:** Should be `chunk["embedding"] = emb.tolist()`  
**Impact:** JSON serialization fails at setup  

### Bug #5: Missing Context in Prompt 🔴 CRITICAL
**Location:** `app/prompt.py` lines 8-18  
**Problem:** Prompt doesn't include retrieved context  
**Solution:** Add `CONTEXT:\n{context}\n` section  
**Impact:** LLM not grounded in documents  

---

## 🚀 Quick Start (3 Steps)

### Step 1: Get Your API Key
```
Visit: https://aistudio.google.com/app/apikey
Copy your Gemini API key
```

### Step 2: Configure
```bash
# Edit .env and add your key:
GEMINI_API_KEY=your_key_here
DEBUG_MODE=True
```

### Step 3: Start Debugging!
```bash
python setup.py
# You'll see Bug #4 error immediately
# Perfect place to start debugging!
```

---

## 📖 Documentation Guides

| Guide | Purpose | Read Time | Best For |
|-------|---------|-----------|----------|
| [QUICK_START.md](QUICK_START.md) | 3-step setup | 5 min | First time |
| [README.md](README.md) | Full reference | 15 min | Understanding system |
| [DEBUGGING_GUIDE.md](DEBUGGING_GUIDE.md) | Bug explanations | 20 min | Finding & fixing bugs |
| [BUG_MAP.md](BUG_MAP.md) | Visual bug locations | 10 min | Bug hunting |
| [COPILOT_PROMPTS.md](COPILOT_PROMPTS.md) | Ready prompts | As needed | Debugging with AI |
| [PROGRESS_CHECKLIST.md](PROGRESS_CHECKLIST.md) | Track progress | Throughout | Staying organized |

---

## 🎮 Running the System

### Initialize Everything
```bash
python setup.py
# Setup, validate, populate vector store
# First error: Bug #4
```

### Run Demo Questions
```bash
python main.py demo
# 4 pre-set questions to test your fixes
```

### Interactive Chat
```bash
python main.py interactive
# Ask questions about company policies
```

### Run Tests
```bash
pytest tests/ -v
# Validate all components are working
```

---

## 🤖 Using GitHub Copilot

### For Each Bug:
1. **Read the error** carefully
2. **Check COPILOT_PROMPTS.md** for suggested prompts
3. **Paste prompt to Copilot** with relevant code
4. **Implement the fix** suggested
5. **Test** with pytest or main.py

### Example Bug #4 Debugging Flow:
```
1. Run: python setup.py
2. See: TypeError: Object of type tuple is not JSON serializable
3. Ask Copilot: "Object of type tuple is not JSON serializable - where's the bug?"
4. Copilot: "Check embeddings.py line 23, should use .tolist()"
5. Fix: Change tuple(emb) → emb.tolist()
6. Test: python setup.py (should work now!)
```

---

## ✅ Success Criteria

### Setup Success
```bash
$ python setup.py
✓ Python version check
✓ Dependencies check  
✓ Knowledge base check
✓ Configuration check
✓ Vector store initialized
✓ All validation tests pass
[SUCCESS] SETUP COMPLETE!
```

### Full System Success
```bash
$ pytest tests/ -v
tests/test_chunking.py::... PASSED ✓
tests/test_retrieval.py::... PASSED ✓
tests/test_rag.py::... PASSED ✓
======== 10+ passed ========

$ python main.py demo
Query 1: ✓ Correct answer (cites documents)
Query 2: ✓ Correct answer (grounded)
Query 3: ✓ Correct answer (grounded)
Query 4: ✓ Correct answer (grounded)
```

---

## 🎯 Debugging Path

```
START
  ↓
python setup.py
  ↓
[ERROR] Bug #4: TypeError
  ↓
Ask Copilot + Fix
  ↓
python setup.py
  ↓
[SUCCESS]
  ↓
python main.py demo
  ↓
[BUG SIGNS: negative similarity, weird formatting]
  ↓
Debug Bugs #1, #2, #3, #5
  ↓
pytest tests/ -v
  ↓
[ALL PASSING]
  ↓
✓ COMPLETE! You've debugged a RAG system!
```

---

## 🎓 What You'll Learn

✅ **System Design** - Full RAG pipeline architecture  
✅ **ML Debugging** - Finding bugs in ML systems  
✅ **Python Skills** - Data structures, type handling  
✅ **Testing** - Writing and running tests  
✅ **AI Assistance** - Using Copilot effectively  
✅ **Problem Solving** - Systematic debugging approach  

---

## 🔧 Useful Commands

```bash
# Setup and Initialize
python setup.py

# Run the System
python main.py setup          # Initialize only
python main.py demo           # Run sample queries
python main.py interactive    # Interactive mode
python main.py all            # Setup + Demo

# Testing
pytest tests/ -v              # All tests
pytest tests/test_rag.py -v   # Specific test file
pytest tests/test_rag.py::test_name -v  # Specific test

# Debugging Individual Modules
python -c "from app.debug import debug_documents; debug_documents()"
python -c "from app.retrieval import debug_retrieval; debug_retrieval('leave')"
python -c "from app.debug import debug_context"

# Clear Vector Store (Start Fresh)
rm -r chroma_db/              # Linux/Mac
rmdir /s chroma_db            # Windows
python setup.py               # Reinitialize
```

---

## ❓ Troubleshooting

### "ModuleNotFoundError"
```bash
pip install -r requirements.txt
```

### "GEMINI_API_KEY not configured"
1. Get key from https://aistudio.google.com/app/apikey
2. Edit `.env` and add it
3. Restart the system

### "No documents found"
```bash
# Check knowledge_base directory
ls knowledge_base/
# Should show 5 .md files
```

### ChromaDB errors
```bash
# Clear and restart
rm -r chroma_db/
python setup.py
```

---

## 🌟 Key Features

- ✅ **Complete RAG System** - Fully functional end-to-end
- ✅ **5 Intentional Bugs** - Strategic learning opportunities  
- ✅ **Comprehensive Docs** - 6 detailed guides
- ✅ **Test Suite** - Validate each fix
- ✅ **Sample Data** - 5 company policy documents
- ✅ **Debug Tools** - Built-in debug utilities
- ✅ **Copilot Ready** - Pre-written debugging prompts
- ✅ **Progress Tracking** - Checklist to stay organized

---

## 🎉 You're All Set!

Everything is ready for you to debug. The system is:
- ✅ Fully configured
- ✅ Well documented  
- ✅ Has intentional bugs
- ✅ Has test suite
- ✅ Has Copilot prompts

**Next Step:** Read [QUICK_START.md](QUICK_START.md) or [COPILOT_PROMPTS.md](COPILOT_PROMPTS.md)

**Then Start Here:** 
```bash
python setup.py  # First error will be Bug #4
```

---

**Happy debugging! You've got this! 🚀🐛✨**

Questions? Use GitHub Copilot to guide you through the debugging process.
