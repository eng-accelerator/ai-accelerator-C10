# 🎯 RAG Debugging Lab - Progress Checklist

Track your progress as you work through debugging the RAG system.

## Pre-Work

- [ ] **Read QUICK_START.md** - Understand the project (5 min)
- [ ] **Read DEBUGGING_GUIDE.md** - Learn about the 5 bugs (10 min)
- [ ] **Get Gemini API Key** - https://aistudio.google.com/app/apikey (2 min)
- [ ] **Edit .env file** - Add your GEMINI_API_KEY (1 min)

**Estimated Time:** 18 minutes

---

## Phase 1: First Run & Bug Discovery

- [ ] **Run initial setup:** `python setup.py`
- [ ] **Observe the error** - You should see JSON serialization error (Bug #4)
- [ ] **Read error message carefully** - This is your first clue!
- [ ] **Check DEBUGGING_GUIDE.md** - Find the section on Bug #4

**Expected Error:**
```
TypeError: Object of type tuple is not JSON serializable
```

**Phase Time:** 5 minutes

---

## Bug Fixing - Order 4, 1, 5, 2, 3

### 🐛 Bug #4: Embedding Type Mismatch (CRITICAL)

**File:** `app/embeddings.py`  
**Line:** ~23

- [ ] **Use Copilot Prompt** - From COPILOT_PROMPTS.md, Bug #4 section
- [ ] **Understand the issue** - Tuples vs Lists for ChromaDB
- [ ] **Make the fix** - Change `tuple(emb)` to `emb.tolist()`
- [ ] **Verify fix:** `python setup.py` should now complete successfully!
- [ ] **Run tests:** `pytest tests/test_chunking.py -v`

**Time Estimate:** 10 minutes  
**Difficulty:** 🟡 Medium  
**Status:** [ ] Complete

```diff
- chunk["embedding"] = tuple(emb)
+ chunk["embedding"] = emb.tolist()
```

---

### 🐛 Bug #1: Similarity Calculation (CRITICAL)

**File:** `app/retrieval.py`  
**Line:** ~45

- [ ] **Run:** `python main.py demo`
- [ ] **Observe output** - Check similarity scores in debug trace
- [ ] **Look for negatives** - Similarity should be 0-1, not negative
- [ ] **Use Copilot Prompt** - From COPILOT_PROMPTS.md, Bug #1 section
- [ ] **Understand math** - How to convert cosine distance to similarity
- [ ] **Make the fix** - Change `dist - 1.0` to `1.0 - dist`
- [ ] **Verify fix:** Run demo again and check for 0-1 range scores
- [ ] **Run tests:** `pytest tests/test_retrieval.py -v`

**Time Estimate:** 10 minutes  
**Difficulty:** 🟡 Medium  
**Status:** [ ] Complete

```diff
- similarity = dist - 1.0
+ similarity = 1.0 - dist
```

---

### 🐛 Bug #5: Missing Context in Prompt (CRITICAL)

**File:** `app/prompt.py`  
**Lines:** 8-18

- [ ] **Run:** `python main.py demo`
- [ ] **Observe LLM responses** - Are they grounded in documents?
- [ ] **Check debug output** - Look at "PROMPT CONSTRUCTION DEBUG"
- [ ] **Notice the problem** - CONTEXT section is missing!
- [ ] **Use Copilot Prompt** - From COPILOT_PROMPTS.md, Bug #5 section
- [ ] **Find template** - Look at what's in the prompt function
- [ ] **Make the fix** - Add CONTEXT: {context} section
- [ ] **Verify fix:** Check PROMPT debug output includes retrieved documents
- [ ] **Run tests:** `pytest tests/test_rag.py -v`

**Time Estimate:** 8 minutes  
**Difficulty:** 🟢 Easy  
**Status:** [ ] Complete

```diff
  return f"""You are a company policy assistant.

  Answer the user's question ONLY using the provided context.

  If the answer cannot be found in the context, say:
  "I don't have enough information in the provided documents."

  Do not invent company policies.

+ CONTEXT:
+ {context}
+
  QUESTION:
  {question}"""
```

---

### 🐛 Bug #2: Context Formatting (MEDIUM)

**File:** `app/context.py`  
**Line:** ~18

- [ ] **Run:** `python main.py demo`
- [ ] **Check context output** - Look for clear separation between chunks
- [ ] **Observe the problem** - Document blocks merged without gaps
- [ ] **Use Copilot Prompt** - From COPILOT_PROMPTS.md, Bug #2 section
- [ ] **Understand string joining** - How to separate blocks with newlines
- [ ] **Make the fix** - Change `"".join(blocks)` to `"\n\n".join(blocks)`
- [ ] **Verify fix:** Check debug output shows clear section breaks
- [ ] **Run tests:** `pytest tests/ -v`

**Time Estimate:** 5 minutes  
**Difficulty:** 🟢 Easy  
**Status:** [ ] Complete

```diff
- return "".join(blocks)
+ return "\n\n".join(blocks)
```

---

### 🐛 Bug #3: Empty Retrieval Handling (MEDIUM)

**File:** `app/rag.py`  
**Line:** ~29

- [ ] **Run:** `python main.py interactive`
- [ ] **Test edge case** - Ask something obscure: "What is the purple unicorn policy?"
- [ ] **Observe behavior** - Should it fail or return generic answer?
- [ ] **Use Copilot Prompt** - From COPILOT_PROMPTS.md, Bug #3 section
- [ ] **Understand validation** - When should we check for empty results?
- [ ] **Make the fix** - Add check after retrieval for empty results
- [ ] **Decide behavior** - Raise error vs return message
- [ ] **Verify fix:** Test with edge case queries
- [ ] **Run tests:** `pytest tests/ -v`

**Time Estimate:** 10 minutes  
**Difficulty:** 🟡 Medium  
**Status:** [ ] Complete

```diff
  # 2. Retrieval
  retrieved_chunks = retrieve(question, top_k=TOP_K)
  trace["retrieved_count"] = len(retrieved_chunks)
  if retrieved_chunks:
      # ... existing code ...
  else:
      trace["top_document"] = "None"
      trace["top_result"] = "No chunks retrieved"

  # 3. Context Construction
+ if not retrieved_chunks:
+     raise ValueError("No relevant documents found for the query.")
  context = build_context(retrieved_chunks)
```

---

## Phase 2: Full System Validation

### Test Suite Verification
- [ ] **Run all tests:** `pytest tests/ -v`
- [ ] **Check output** - All tests should PASS
- [ ] **Fix any failures** - Go back and verify each fix
- [ ] **Re-run tests** - Ensure 100% passing

**Expected Output:**
```
tests/test_chunking.py::... PASSED
tests/test_retrieval.py::... PASSED
tests/test_rag.py::... PASSED
======== 10+ passed ========
```

**Time Estimate:** 5 minutes

---

### Demo Validation
- [ ] **Run demo:** `python main.py demo`
- [ ] **Check output quality** - Answers should cite documents
- [ ] **Verify accuracy** - Answers should match company policies
- [ ] **Look for issues** - Any error messages or odd behavior?

**Expected Output:**
- Question 1: Answer cites leave policy (24 days)
- Question 2: Answer cites travel policy
- Question 3: Answer cites WFH guidelines
- Question 4: Answer cites benefits policy

**Time Estimate:** 3 minutes

---

### Interactive Testing
- [ ] **Start interactive:** `python main.py interactive`
- [ ] **Test Case 1:** "What is the annual leave policy?"
- [ ] **Test Case 2:** "How many days vacation do I get?"
- [ ] **Test Case 3:** "What are the WFH guidelines?"
- [ ] **Test Case 4:** "Tell me about business travel"
- [ ] **Test Case 5 (Edge):** "What's the purple unicorn policy?"
- [ ] **Observe behavior** - All should give appropriate responses

**Time Estimate:** 10 minutes

---

## Phase 3: Advanced Exploration (Optional)

- [ ] **Customize knowledge base** - Add your own .md files
- [ ] **Change embedding model** - Try different SentenceTransformer models
- [ ] **Adjust parameters** - Change CHUNK_SIZE, TOP_K, etc.
- [ ] **Modify LLM** - Try different temperature/model settings
- [ ] **Create custom test** - Write test for your use case

**Time Estimate:** 30+ minutes (optional)

---

## Summary & Results

### Debugging Session Stats
- **Total Time:** _____ minutes
- **Bugs Fixed:** _____ out of 5
- **Tests Passing:** _____ out of 10+
- **Difficulty Level:** 🟢 Easy / 🟡 Medium / 🔴 Hard

### Bugs Successfully Fixed
- [ ] Bug #4 - Embedding type mismatch
- [ ] Bug #1 - Similarity calculation
- [ ] Bug #5 - Missing context in prompt
- [ ] Bug #2 - Context formatting
- [ ] Bug #3 - Empty retrieval handling

### System Status
- [ ] Setup completes without errors
- [ ] All tests passing
- [ ] Demo produces correct outputs
- [ ] Interactive mode works smoothly
- [ ] System is production-ready (for this learning exercise)

---

## 🎓 What You Learned

### Understanding
- [ ] How RAG pipeline works end-to-end
- [ ] Vector embeddings and similarity search
- [ ] Prompt engineering basics
- [ ] ChromaDB usage patterns
- [ ] Error analysis and debugging

### Skills
- [ ] Reading error messages effectively
- [ ] Using debug output for problem diagnosis
- [ ] Asking Copilot for code help
- [ ] Test-driven debugging approach
- [ ] Fixing ML/Python bugs systematically

### Knowledge
- [ ] Cosine similarity mathematics
- [ ] JSON serialization issues
- [ ] String formatting in Python
- [ ] LLM prompt construction
- [ ] Vector database operations

---

## 📝 Notes & Reflections

### Bugs Found
```
Bug #4: [describe your understanding]

Bug #1: [describe your understanding]

Bug #5: [describe your understanding]

Bug #2: [describe your understanding]

Bug #3: [describe your understanding]
```

### Challenges Encountered
```
1. 

2. 

3. 
```

### How You Solved Them
```
1. 

2. 

3. 
```

### Key Insights
```
1. 

2. 

3. 
```

---

## 🎉 Completion Checklist

- [ ] All 5 bugs debugged and fixed
- [ ] All tests passing
- [ ] Demo runs successfully
- [ ] Interactive mode works
- [ ] Completed this checklist
- [ ] Understood each bug thoroughly
- [ ] Could explain bugs to someone else
- [ ] Ready for next learning challenge

---

**Congratulations! You've successfully debugged a complete RAG system! 🚀**

**Next Steps:**
1. Try modifying the knowledge base
2. Experiment with different parameters
3. Add custom policies and test retrieval
4. Deploy as a simple API
5. Explore more advanced RAG techniques

---

**Start with Bug #4!** 🐛👉 Run: `python setup.py`
