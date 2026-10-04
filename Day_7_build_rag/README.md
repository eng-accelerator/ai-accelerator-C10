# Day 7 - RAG Assignments

This directory contains assignments for Day 7, focusing on building RAG (Retrieval-Augmented Generation) systems with LlamaIndex.

## Assignment 1: Vector Database Creation and Retrieval

**File:** `assignment_1_multimodal_vector_db.ipynb`  
**Solution:** `assignment_1_solution.ipynb`

### Objective
Learn the fundamentals of vector databases by creating a complete document indexing and retrieval system.

### Learning Goals
- Understand document loading with `SimpleDirectoryReader`
- Learn vector store setup with LanceDB
- Implement vector index creation with `StorageContext`
- Perform semantic search and retrieval
- Use local embeddings (no OpenAI API key required)
- Configured for OpenRouter compatibility (when LLM needed)

### What You'll Build
1. **Document Loader**: Load documents from a folder using `SimpleDirectoryReader`
2. **Vector Store**: Create a LanceDB vector store for embeddings
3. **Index Creator**: Build a vector index from documents
4. **Search Function**: Implement semantic search functionality

### Instructions
1. Open `assignment_1_multimodal_vector_db.ipynb`
2. Complete each function by replacing the TODO comments
3. Run each cell after completing the function to test it
4. Refer to the existing notebooks in `llamaindex_rag/` folder for examples
5. Use `assignment_1_solution.ipynb` to check your answers

### API Configuration
- No OpenAI API key required - uses local embeddings
- OpenRouter ready - configured for future LLM operations
- Cost-effective - all vector operations run locally

### Key Concepts Covered
- **SimpleDirectoryReader**: Loading documents from folders
- **LanceDBVectorStore**: Vector storage with LanceDB
- **StorageContext**: Managing storage components
- **VectorStoreIndex**: Creating searchable indexes
- **Semantic Retrieval**: Finding relevant documents by meaning

### Expected Output
After completing all functions, you should be able to:
- Load documents from the `../data` folder
- Create a vector database
- Search for documents using natural language queries
- Get relevant results with similarity scores

### Tips
- The data folder contains diverse file types (PDFs, CSVs, Markdown, HTML, etc.)
- SimpleDirectoryReader handles multiple file formats automatically
- Use `recursive=True` to load files from subdirectories
- LanceDB provides efficient vector storage and retrieval
- The similarity scores help evaluate result relevance

## Dataset
The assignment uses the data in `../data/` which includes:
- AI research papers (PDFs)
- Agent evaluation metrics (CSV)
- Cooking recipes (Markdown, CSV)
- Financial data (CSV, Markdown)
- Health tracking data (HTML)
- Travel guides (Markdown)
- Various images

This diverse dataset demonstrates the multimodal capabilities of the RAG system.

## Getting Help
If you get stuck:
1. Check the existing notebooks in `llamaindex_rag/` for examples
2. Look at the solution file for guidance
3. Review the LlamaIndex documentation
4. Ask for help during the session

## Assignment 2: Advanced RAG Techniques

**File:** `assignment_2_advanced_rag.ipynb`  
**Solution:** `assignment_2_solution.ipynb`

### Objective
Master advanced RAG techniques that transform basic document retrieval into production-ready, intelligent systems.

### Learning Goals
- Understand and implement node postprocessors for filtering and reranking
- Learn different response synthesis strategies (TreeSummarize, Refine)
- Create structured outputs using Pydantic models
- Build advanced retrieval pipelines with multiple processing stages

### Prerequisites
- Complete Assignment 1 first
- Understanding of basic vector databases and retrieval

### What You'll Build
1. **Similarity Postprocessor**: Filter low-relevance results for better precision
2. **TreeSummarize Engine**: Create comprehensive analytical responses
3. **Structured Output System**: Generate type-safe JSON responses
4. **Advanced Pipeline**: Combine all techniques into production-ready system

### Advanced Concepts Covered
- **Node Postprocessors**: `SimilarityPostprocessor` for result filtering
- **Response Synthesizers**: `TreeSummarize` for complex analysis
- **Structured Outputs**: `PydanticOutputParser` for type-safe responses
- **Advanced Pipelines**: Combining multiple techniques

### Instructions
1. Complete Assignment 1 before starting this one
2. Open `assignment_2_advanced_rag.ipynb`
3. Complete each function by replacing the TODO comments
4. Run each cell after completing the function to test it
5. Refer to the `03_advanced_rag_techniques.ipynb` notebook for examples
6. Use `assignment_2_solution.ipynb` to check your answers

### API Configuration
- OpenRouter LLM required - for response synthesis
- Local embeddings - cost-effective vector operations
- LLM operations - needed for advanced response synthesis

### Expected Output
After completing all functions, you should be able to:
- Filter search results based on relevance scores
- Generate comprehensive analytical responses
- Receive structured JSON outputs instead of free text
- Compare basic vs advanced RAG performance

### Key Benefits
- **Better Precision**: Similarity filtering removes irrelevant results
- **Comprehensive Analysis**: TreeSummarize provides deeper insights
- **Reliable Integration**: Structured outputs enable system integration
- **Production Ready**: Advanced pipelines suitable for real applications
