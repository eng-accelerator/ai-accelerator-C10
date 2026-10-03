# Intentional Bugs - Debugging Guide

This file documents all intentional bugs introduced in the RAG system for debugging practice.

## 🐛 Bug #1: Similarity Calculation Error

**File:** [`app/retrieval.py`](app/retrieval.py)  
**Line:** ~45  
**Severity:** 🔴 Critical  

### The Bug
```python
# WRONG - Line 45
similarity = dist - 1.0  # Calculates negative similarity

# CORRECT
similarity = 1.0 - dist
```

### Impact
- Similarity scores will be **negative** when they should be positive (0-1 range)
- Lower similarity scores will appear higher, inverting relevance ranking
- Debug trace will show incorrect similarity percentages

### How to Debug
1. Run: `python main.py demo`
2. Look at similarity scores - they should be between 0 and 1
3. Use Copilot: "Why are my similarity scores negative?"

### Expected Output
```
Similarity: -0.234567  # WRONG - should be 0.765432
```

---

## 🐛 Bug #2: Context Building - Missing Separator

**File:** [`app/context.py`](app/context.py)  
**Line:** ~18  
**Severity:** 🟡 Medium  

### The Bug
```python
# WRONG - Line 18
return "".join(blocks)  # Concatenates without separator

# CORRECT
return "\n\n".join(blocks)
```

### Impact
- Retrieved document chunks will be concatenated directly without separation
- LLM will have difficulty distinguishing between different documents
- Context will be harder to read in debug traces

### How to Debug
1. Run: `python main.py demo`
2. Look at "CONTEXT" debug output - chunks should be clearly separated
3. Use Copilot: "Why is my context not properly formatted?"

### Expected Output
```
WRONG:
[Document: leave_policy.md]Annual leave is....[Document: travel_policy.md]Travel must...

CORRECT:
[Document: leave_policy.md]
Annual leave is....

[Document: travel_policy.md]
Travel must...
```

---

## 🐛 Bug #3: Empty Retrieval Handling

**File:** [`app/rag.py`](app/rag.py)  
**Line:** ~29  
**Severity:** 🟡 Medium  

### The Bug
```python
# WRONG - No validation
context = build_context(retrieved_chunks)
trace["context"] = "✓ Generated"  # Even if no chunks retrieved!

# CORRECT
if not retrieved_chunks:
    raise ValueError("No relevant documents found for the query.")
context = build_context(retrieved_chunks)
trace["context"] = "✓ Generated"
```

### Impact
- Pipeline doesn't fail gracefully when no relevant documents are found
- LLM receives empty context but prompt still asks for grounded answer
- False confidence in answer when information wasn't actually retrieved

### How to Debug
1. Test with an obscure question: `python main.py interactive`
2. Ask: "What is the policy on purple unicorns?"
3. Use Copilot: "The RAG pipeline should handle zero results better"

---

## 🐛 Bug #4: Wrong Embedding Type

**File:** [`app/embeddings.py`](app/embeddings.py)  
**Line:** ~23  
**Severity:** 🔴 Critical  

### The Bug
```python
# WRONG - Line 23
chunk["embedding"] = tuple(emb)  # Converts to tuple

# CORRECT
chunk["embedding"] = emb.tolist()  # Converts to list
```

### Impact
- ChromaDB expects embeddings as **lists**, not tuples
- Will cause serialization errors when saving to vector store
- System will crash during ingestion
- Error message: `TypeError: Object of type tuple is not JSON serializable`

### How to Debug
1. Clear vector store: `rm -r chroma_db/`
2. Run: `python setup.py`
3. Look for JSON serialization errors
4. Use Copilot: "Fix this JSON serialization error: [paste error]"

---

## 🐛 Bug #5: Missing Context in Prompt

**File:** [`app/prompt.py`](app/prompt.py)  
**Line:** ~8-18  
**Severity:** 🔴 Critical  

### The Bug
```python
# WRONG - Context not included
return f"""You are a company policy assistant.
...
QUESTION:
{question}"""

# CORRECT
return f"""You are a company policy assistant.
...
CONTEXT:
{context}

QUESTION:
{question}"""
```

### Impact
- **LLM never receives the retrieved context!**
- RAG system becomes a regular LLM without grounding
- Answers will be generic and not based on company documents
- Defeats the entire purpose of the RAG system

### How to Debug
1. Run: `python main.py demo`
2. Check the "PROMPT CONSTRUCTION DEBUG" output
3. You should see CONTEXT section but it's missing
4. Use Copilot: "The LLM prompt is missing the retrieved context"

### Expected Output
```
WRONG:
QUESTION:
How many annual leaves do employees receive?
[No CONTEXT section!]

CORRECT:
CONTEXT:
[Document: leave_policy.md]
Annual leave is 24 days...

QUESTION:
How many annual leaves do employees receive?
```

---

## 🧪 Testing the Bugs

### Run Setup (will crash with Bug #4)
```bash
python setup.py
# Look for: TypeError: Object of type tuple is not JSON serializable
```

### Run Demo Queries (with other bugs active)
```bash
python main.py demo
```

### Interactive Testing
```bash
python main.py interactive
# Ask: "What is the annual leave policy?"
# Expected: Should cite leave_policy.md
# Bug Impact: Won't cite documents due to missing context
```

### Debug Each Stage
```bash
# Check document loading
python -c "from app.documents import load_documents; print(load_documents())"

# Check chunking
python -c "from app.debug import debug_chunks; debug_chunks()"

# Check retrieval
python -c "from app.retrieval import debug_retrieval; debug_retrieval('What is the leave policy?')"

# Check context building
python -c "from app.debug import debug_context; debug_context()"
```

---

## 🔍 Debugging Strategy with Copilot

### Prompt 1: General Issue
```
I'm running a RAG system and the output doesn't look right. 
Here's the debug trace:
[paste debug output]

What's wrong?
```

### Prompt 2: Specific File
```
Can you analyze this code in app/retrieval.py for bugs?
I'm getting negative similarity scores.
```

### Prompt 3: Error Message
```
I got this error when running setup.py:
TypeError: Object of type tuple is not JSON serializable

Where's the bug and how do I fix it?
```

### Prompt 4: Logic Error
```
My RAG system isn't using the retrieved documents in the LLM prompt.
The context is empty. Can you find the bug in:
- app/context.py
- app/prompt.py
- app/rag.py
```

---

## ✅ How to Fix All Bugs

Once you've debugged and found all issues, here's the correct code:

### Fix Bug #1 (retrieval.py)
```python
similarity = 1.0 - dist
```

### Fix Bug #2 (context.py)
```python
return "\n\n".join(blocks)
```

### Fix Bug #3 (rag.py)
```python
if not retrieved_chunks:
    raise ValueError("No relevant documents found for the query.")
context = build_context(retrieved_chunks)
```

### Fix Bug #4 (embeddings.py)
```python
chunk["embedding"] = emb.tolist()
```

### Fix Bug #5 (prompt.py)
```python
return f"""You are a company policy assistant.

Answer the user's question ONLY using the provided context.

If the answer cannot be found in the context, say:

"I don't have enough information in the provided documents."

Do not invent company policies.

CONTEXT:
{context}

QUESTION:
{question}"""
```

---

## 🚀 Next Steps

1. **Identify bugs** by running the system and observing errors
2. **Use Copilot** to ask for help: "What's wrong with this output?"
3. **Debug one bug at a time** to avoid confusion
4. **Test after each fix** with: `pytest tests/ -v`
5. **Verify complete pipeline** works with: `python main.py demo`

---

## 📊 Bug Difficulty Levels

| Bug | Level | Time to Debug |
|-----|-------|---------------|
| #4 (Tuple vs List) | 🔴 Hard | 10-15 mins |
| #5 (Missing Context) | 🟡 Medium | 5-10 mins |
| #1 (Similarity Math) | 🟡 Medium | 5-10 mins |
| #2 (Missing Separator) | 🟢 Easy | 2-5 mins |
| #3 (Empty Handling) | 🟢 Easy | 2-5 mins |

---

**Ready to debug? Start with `python setup.py` and look for the first error!** 🐛🔍
