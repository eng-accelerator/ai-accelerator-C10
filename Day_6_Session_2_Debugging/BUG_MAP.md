# RAG System - Bug Map & Testing Flow

## 🗺️ Where Each Bug Affects the Pipeline

```
User Question
    ↓
┌─────────────────────────────────────────────────┐
│ Stage 1: Query Embedding                        │
│ (app/embeddings.py - embed_query)               │
│ ✓ No bugs here                                  │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Stage 2: Retrieval                              │
│ (app/retrieval.py)                              │
│ 🐛 BUG #1: similarity = dist - 1.0              │
│    → Negative similarity scores                 │
│ 🐛 BUG #4: tuple(emb) instead of emb.tolist()  │
│    → JSON serialization fails in ChromaDB       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Stage 3: Context Building                       │
│ (app/context.py)                                │
│ 🐛 BUG #2: "".join(blocks) missing separators   │
│    → Chunks merged without gaps                 │
│ 🐛 BUG #3: No check for empty results           │
│    → Proceeds with empty context                │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Stage 4: Prompt Construction                    │
│ (app/prompt.py)                                 │
│ 🐛 BUG #5: Context not included in prompt       │
│    → LLM never sees retrieved information       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Stage 5: LLM Generation                         │
│ (app/llm.py)                                    │
│ ✓ No bugs here                                  │
└─────────────────────────────────────────────────┘
    ↓
Answer (Incorrect/Incomplete due to bugs)
```

---

## 🔄 Testing Sequence

### Phase 1: Setup & Initialization
```
START
  ↓
python setup.py
  ↓
[FAIL] Bug #4: tuple → JSON error
  ↓
USE COPILOT TO DEBUG
  ↓
Fix embeddings.py line 23
  ↓
python setup.py
  ↓
[SUCCESS]
```

### Phase 2: Similarity Testing
```
python main.py demo
  ↓
[Observe negative similarity scores]
  ↓
DEBUG: Check retrieval.py similarity calculation
  ↓
Fix Bug #1: dist - 1.0 → 1.0 - dist
  ↓
Run pytest tests/test_retrieval.py -v
  ↓
[Check for negative similarities in tests]
```

### Phase 3: Context & Retrieval Testing
```
python main.py demo
  ↓
[Observe poor context formatting]
  ↓
DEBUG: Check context building and retrieval
  ↓
Fix Bug #2: "".join() → "\n\n".join()
Fix Bug #3: Add empty check in rag.py
  ↓
Run pytest tests/ -v
```

### Phase 4: LLM Integration Testing
```
Set GEMINI_API_KEY in .env
  ↓
python main.py demo
  ↓
[Observe generic LLM answers]
  ↓
[LLM doesn't use retrieved documents]
  ↓
DEBUG: Check prompt construction
  ↓
Fix Bug #5: Add CONTEXT section to prompt
  ↓
python main.py demo
  ↓
[Observe grounded, accurate answers]
  ↓
pytest tests/test_rag.py -v
```

### Phase 5: Full Validation
```
pytest tests/ -v
  ↓
[All tests passing]
  ↓
python main.py demo
  ↓
[Correct outputs]
  ↓
python main.py interactive
  ↓
[Manual testing complete]
  ↓
SUCCESS! ✓
```

---

## 🐛 Bug Severity & Impact Analysis

### Bug #4: Tuple Type Mismatch 🔴 CRITICAL
```
When: During setup (populate_vector_store)
Error: TypeError: Object of type tuple is not JSON serializable
Impact: BLOCKS - System cannot initialize
Fix Difficulty: Medium (understand ChromaDB expectations)
Test: python setup.py
```

### Bug #1: Similarity Calculation 🔴 CRITICAL
```
When: During retrieval (chunk ranking)
Error: No error, but WRONG OUTPUT (negative scores)
Impact: BLOCKS - Relevance ranking completely inverted
Fix Difficulty: Easy (understand similarity math)
Test: Check debug output for negative values
```

### Bug #5: Missing Context 🔴 CRITICAL
```
When: During LLM generation
Error: No error, but LLM not grounded in documents
Impact: BLOCKS - Defeats purpose of RAG
Fix Difficulty: Easy (add missing template variable)
Test: Check LLM prompt contains context
```

### Bug #2: Context Formatting 🟡 MEDIUM
```
When: Displaying context
Error: No error, but poor readability
Impact: DEGRADES - LLM might struggle with merged text
Fix Difficulty: Easy (add separator)
Test: Check debug output formatting
```

### Bug #3: Empty Retrieval 🟡 MEDIUM
```
When: No relevant documents found
Error: No error, but should fail gracefully
Impact: REDUCES - Causes false confidence
Fix Difficulty: Easy (add validation check)
Test: Query with unrelated topic
```

---

## 🧪 Test Commands Reference

### Individual Bug Tests
```bash
# Test Bug #4 (setup fails)
python setup.py

# Test Bug #1 (negative similarities)
python -c "from app.retrieval import debug_retrieval; debug_retrieval('leave policy')"

# Test Bug #2 (context formatting)
python -c "
from app.debug import debug_documents, debug_chunks
from app.retrieval import retrieve
from app.context import build_context, inspect_context
chunks = retrieve('leave policy')
context = build_context(chunks)
inspect_context(context)
"

# Test Bug #3 (empty retrieval)
python -c "
from app.rag import rag
try:
    answer = rag('xyzabc nonsense query')
    print('ERROR: Should have failed!')
except Exception as e:
    print(f'Good: {e}')
"

# Test Bug #5 (missing context in prompt)
python -c "
from app.debug import debug_documents, debug_chunks
from app.retrieval import retrieve
from app.context import build_context
from app.prompt import debug_prompt
chunks = retrieve('leave policy')
context = build_context(chunks)
debug_prompt('How many days leave?', context)
"
```

### Full Test Suite
```bash
# All tests
pytest tests/ -v

# Individual test files
pytest tests/test_chunking.py -v
pytest tests/test_retrieval.py -v
pytest tests/test_rag.py -v

# Specific test
pytest tests/test_rag.py::test_rag_end_to_end_answering -v

# With output
pytest tests/ -v -s
```

---

## 🔍 Debug Output Inspection

### What to Look For in Debug Traces

#### Bug #1 Signature (Negative Similarity)
```
Similarity: -0.234567  ← WRONG!
           -1.765432  ← WRONG!
(Should be: 0.765432 and 0.234567)
```

#### Bug #2 Signature (Merged Context)
```
[Document: leave_policy.md]Annual leave is...[Document: travel_policy.md]Travel policy...
(Should have blank line between sections)
```

#### Bug #3 Signature (No Error on Empty)
```
Retrieved chunks: 0
Context: (empty)
Prompt sent to LLM: [with no context section]
LLM: "I don't have specific information..." ← Generic response
```

#### Bug #4 Signature (JSON Error)
```
TypeError: Object of type tuple is not JSON serializable
File: app/embeddings.py, line 23
```

#### Bug #5 Signature (Missing Context in Prompt)
```
CONTEXT:
[Nothing here!]

QUESTION:
How many days of leave?
```

---

## 📊 Bug Difficulty Ranking

```
Level 1 (Easiest - ~5 minutes)
├─ Bug #2: String join (add "\n\n")
└─ Bug #3: Empty check (add if statement)

Level 2 (Medium - ~10 minutes)
├─ Bug #1: Similarity math (1.0 - dist)
└─ Bug #5: Missing string (add variable)

Level 3 (Hardest - ~15 minutes)
└─ Bug #4: Type understanding (list vs tuple)
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
✓ Vector store initialization
✓ All tests passing
[SUCCESS] SETUP COMPLETE!
```

### Demo Success
```bash
$ python main.py demo
✓ Question 1: Correct answer about leave policy (24 days)
✓ Question 2: Correct answer about travel policy
✓ Question 3: Correct answer about WFH guidelines
✓ Question 4: Correct answer about benefits
[All outputs grounded in documents]
```

### Test Success
```bash
$ pytest tests/ -v
tests/test_chunking.py::... PASSED
tests/test_retrieval.py::... PASSED
tests/test_rag.py::... PASSED
======== 10 passed ========
```

---

## 🎯 Debugging Workflow Diagram

```
┌─────────────────────────────────────┐
│ Problem/Error Encountered           │
└──────────────┬──────────────────────┘
               ↓
         ┌─────────────┐
         │ Google the  │ (If simple error)
         │  error msg  │
         └──────┬──────┘
                ↓
         ┌─────────────────┐
         │ Run the system  │ (Reproduce the issue)
         │ with DEBUG=True │
         └──────┬──────────┘
                ↓
         ┌──────────────────────────┐
         │ Analyze debug output     │
         │ Look for wrong values    │
         │ Check intermediate steps │
         └──────┬───────────────────┘
                ↓
         ┌──────────────────────────┐
         │ Narrow down to file/func │
         │ Review the code          │
         └──────┬───────────────────┘
                ↓
         ┌──────────────────────────┐
         │ Ask Copilot:             │
         │ "What's wrong with this? │
         │  [paste code]"           │
         └──────┬───────────────────┘
                ↓
         ┌──────────────────────────┐
         │ Implement the fix        │
         └──────┬───────────────────┘
                ↓
         ┌──────────────────────────┐
         │ Run tests                │
         │ pytest tests/ -v         │
         └──────┬───────────────────┘
                ↓
    ┌───────────────────────┐
    │ Tests Passing?        │
    └───────┬───────────────┘
            │
      YES   │   NO
    ┌───────┴─────────┐
    ↓                 ↓
  DONE!          Fix Failed
                  (back to step 4)
```

---

**Start debugging with:** `python setup.py` 🚀

Good luck! 🍀
