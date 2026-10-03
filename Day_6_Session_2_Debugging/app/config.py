import os
from dotenv import load_dotenv

# Load env variables from .env file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

# Embeddings config
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Retrieval config
TOP_K = 3

# Chunking config (characters)
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100

# Observability config
DEBUG_MODE = os.getenv("DEBUG_MODE", "True").lower() == "true"

# LLM config
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"

# Directories
CHROMADB_PATH = os.path.join(BASE_DIR, "chroma_db")
KNOWLEDGE_BASE_DIR = os.path.join(BASE_DIR, "knowledge_base")
