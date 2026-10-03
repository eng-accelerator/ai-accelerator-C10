# Copilot Prompts for Debugging Each Bug

Use these prompts with GitHub Copilot to help you debug and fix each bug. Copy-paste them directly into the chat.

---

## 🐛 Bug #4: Embedding Type Mismatch (Start Here!)

This is the first bug you'll encounter when running `python setup.py`.

### Prompt 1: Understand the Error
```
I'm getting this error when running python setup.py:

TypeError: Object of type tuple is not JSON serializable

What does this mean and where is the bug?
```

### Prompt 2: Find the Specific Issue
```
Looking at app/embeddings.py, I see this code:

```python
for chunk, emb in zip(chunks, embeddings):
    chunk["embedding"] = tuple(emb)
```

ChromaDB is complaining about JSON serialization. What's wrong and how do I fix it?
```

### Prompt 3: Get the Exact Fix
```
The embeddings need to be stored as Python lists, not tuples, for ChromaDB compatibility.
Here's the buggy line:
    chunk["embedding"] = tuple(emb)

What should this line be instead?
```

---

## 🐛 Bug #1: Similarity Calculation Error

After fixing Bug #4, you'll notice this when running `python main.py demo`.

### Prompt 1: Diagnose Wrong Values
```
When I run my RAG system, the similarity scores are negative:
Similarity: -0.234567
Similarity: -0.765432

But similarity should be between 0 and 1. What's causing this?
```

### Prompt 2: Find the Bug in Code
```
In app/retrieval.py, here's the similarity calculation:

```python
dist = distances[i]
similarity = dist - 1.0
```

This is giving negative numbers. How should I calculate similarity from distance?
```

### Prompt 3: Understand the Math
```
In cosine similarity:
- Distance ranges from 0 to 2
- Distance = 0 means identical (similarity = 1.0)
- Distance = 1 means orthogonal (similarity = 0.0)
- Distance = 2 means opposite (similarity = -1.0)

What's the correct formula to convert distance to similarity (0-1 range)?
```

### Prompt 4: Get the Fix
```
The current code: similarity = dist - 1.0
Should be: similarity = ?

What should replace the ?
```

---

## 🐛 Bug #5: Missing Context in Prompt

You'll notice this when LLM responses are generic instead of grounded.

### Prompt 1: Detect the Issue
```
My LLM is not using the retrieved documents. It's giving generic answers instead of citing the knowledge base.

When I ask "What is the annual leave policy?" it says "I don't have information" 
even though the document was retrieved.

What's wrong with the RAG pipeline?
```

### Prompt 2: Check the Prompt
```
Here's my LLM prompt construction:

```python
def build_prompt(question: str, context: str) -> str:
    return f"""You are a company policy assistant.

Answer the user's question ONLY using the provided context.

QUESTION:
{question}"""
```

The context variable is passed in but not used. What's missing?
```

### Prompt 3: Get the Fix
```
The prompt is missing a CONTEXT section. Here's the template:

```python
return f"""You are a company policy assistant.

Answer using the provided context.

[MISSING SECTION HERE]

QUESTION:
{question}"""
```

Fill in the missing section that includes the retrieved context.
```

---

## 🐛 Bug #2: Context Formatting (Missing Separators)

Check debug output to see if document chunks are running together.

### Prompt 1: Identify Poor Formatting
```
My debug output shows retrieved documents all mashed together:

[Document: leave_policy.md]Annual leave is...[Document: travel_policy.md]Travel must...

There's no clear separation. How do I fix this?
```

### Prompt 2: Find the Bug
```
In app/context.py, I have this code:

```python
blocks = []
for chunk in retrieved_chunks:
    doc_name = chunk["metadata"].get("document", "Unknown")
    text = chunk["text"].strip()
    blocks.append(f"[Document: {doc_name}]\n{text}")

return "".join(blocks)
```

The blocks list is correct, but the join is wrong. How should I join them?
```

### Prompt 3: Understand String Joining
```
I want to join these blocks with clear separation:
["Block 1...", "Block 2...", "Block 3..."]

Currently using: "".join(blocks) - no separation
Should use: ?

What string should separate them?
```

---

## 🐛 Bug #3: Empty Retrieval Handling

This one is subtle - the system doesn't fail gracefully when no documents match.

### Prompt 1: Detect the Issue
```
When I ask my RAG system an obscure question like "What is the policy on purple unicorns?" 
it should probably fail because there are no matching documents.

Instead it keeps going and gives a generic LLM response.

Should the RAG pipeline validate that it got relevant results?
```

### Prompt 2: Review the Code
```
In app/rag.py, after retrieval I have:

```python
retrieved_chunks = retrieve(question, top_k=TOP_K)
trace["retrieved_count"] = len(retrieved_chunks)

# ... continues without checking if retrieved_chunks is empty ...

context = build_context(retrieved_chunks)  # Empty context!
```

Should I add validation here? What check?
```

### Prompt 3: Get the Fix
```
Before building context, I should validate that we actually retrieved relevant chunks.

What check should I add after:
retrieved_chunks = retrieve(question, top_k=TOP_K)

Should I raise an error if no chunks were retrieved?
```

---

## 🧪 After Fixing All Bugs

### Validation Prompt
```
I've fixed all the bugs in my RAG system. How should I validate that everything works?

What tests should I run?
```

### Answer Should Include
```
Run these commands:
1. pytest tests/ -v
2. python main.py demo
3. python main.py interactive

All tests should pass and demo questions should show accurate, grounded answers.
```

---

## 🎓 Learning Prompts

### Understanding the Pipeline
```
Explain to me how this RAG (Retrieval-Augmented Generation) pipeline works end-to-end,
from user question to final answer. What happens at each stage?
```

### Common RAG Issues
```
What are the most common bugs or issues people encounter when building RAG systems?
How should we validate that retrieval is working correctly?
```

### Debugging Strategies
```
What's the best workflow for debugging a broken RAG pipeline?
How do I know if the bug is in retrieval vs. context building vs. prompt construction?
```

---

## 💡 Pro Tips for Using These Prompts

1. **Copy the entire code block** - Include 3-5 lines of context around the bug
2. **Show the error/unexpected output** - Paste exact error messages or debug output
3. **Ask follow-up questions** - Don't hesitate to ask Copilot to explain further
4. **Use the suggested fix immediately** - Test it right away with pytest or main.py
5. **Compare before/after** - Show both buggy and fixed versions if confused

---

## 🚀 Quick Debugging Template

When you encounter any issue:

```
Problem: [What's wrong]

Code: [Paste the relevant function]

Error/Output: [Paste the exact error or wrong output]

What's causing this and how do I fix it?
```

For example:
```
Problem: Similarity scores are negative

Code:
    dist = distances[i]
    similarity = dist - 1.0

Error/Output: 
    Similarity: -0.234567 (should be 0 to 1)

What's causing this and how do I fix it?
```

---

**Pro Tip:** Start with Bug #4 and work through in order. Each fix builds understanding for the next one!

Good luck debugging! 🐛✨
