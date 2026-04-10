# DocuChat — Deployment Documentation

This document covers the full deployment process for DocuChat, including the branch strategy, every fix that was applied, how `vercel.json` works, and the challenges encountered along the way.

---

## Branch Strategy

The project uses two separate deployment branches, each targeting a different platform:

| Branch | Platform | Embeddings | Voice | ChromaDB Collection |
|---|---|---|---|---|
| `voice_assistant` / `main` | Render (planned) | sentence-transformers (local) | Whisper (local) | `knowledge_base` |
| `vercel-deploy` | Vercel | Cohere Embed API | Removed | `knowledge_base_cohere` |

### Why Two Branches?

Vercel serverless functions have a **250 MB compressed size limit**. The original stack included:

- `torch` — 339 MB (required by both `sentence-transformers` and `whisper`)
- `transformers` — 54 MB

Together these exceed Vercel's limit before any application code is even included. The `vercel-deploy` branch strips those out entirely and replaces local embedding with the Cohere Embed API, which is an HTTP call with no local model.

### Why Two Separate ChromaDB Collections?

`sentence-transformers/all-MiniLM-L6-v2` and `cohere/embed-english-v3.0` produce vectors in completely different embedding spaces. A query embedded by one model cannot be used to search a collection indexed by the other — the similarity scores are meaningless. Two collections are required:

- `knowledge_base` — indexed with sentence-transformers (384-dim vectors)
- `knowledge_base_cohere` — indexed with Cohere embed-english-v3.0 (1024-dim vectors)

Both live in the same ChromaDB Cloud database (`DocuChat`) but are completely independent.

---

## How `vercel.json` Works

Vercel uses `vercel.json` at the project root to configure how the project is built and routed.

### Vercel's Python Runtime (2024+)

Vercel's new Python runtime auto-detects the framework (FastAPI, Flask, etc.) and installs dependencies. The key behaviors to understand:

1. **It reads `pyproject.toml` first, not `requirements.txt`.** If `pyproject.toml` exists and has no `[project.dependencies]` section, nothing is installed. This was the root cause of the `ModuleNotFoundError: No module named 'fastapi'` error.

2. **It bundles all project files into the serverless function.** Files not in the project directory (e.g. local venv packages) are excluded.

3. **The `builds` key uses the older `@vercel/python` builder**, which has different behavior from the new auto-detection runtime. Mixing both can cause conflicts.

### Final `vercel.json`

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index" }
  ]
}
```

**`version: 2`** — Targets Vercel's current platform API. Version 1 is legacy.

**`rewrites`** — Unlike `routes`, rewrites forward requests internally without changing the URL visible to the browser. Every incoming URL pattern `(.*)` is forwarded to the Python serverless function at `/api/index`.

**Why `/api/index` and not `/main.py`?** Vercel's new runtime treats Python files inside the `api/` directory as serverless functions by default. This is the most reliable and well-documented pattern. Files outside `api/` may or may not be treated as functions depending on the runtime version.

### Entry Point Chain

```
Browser request
    │
    ▼
vercel.json rewrites → /api/index
    │
    ▼
api/index.py
  sys.path.insert(0, project_root)   ← ensures src/ is importable
  from src.api.api import app         ← imports the FastAPI app
    │
    ▼
src/api/api.py
  app = FastAPI(...)
  get_chat_bot() → lazy init RetrievalChatCLI
```

---

## Full List of Fixes Applied

### 1. ChromaDB API key typo in `.env`
**File:** `src/rag_bot/.env`

The key was named `CHROMA_API_KAY` (typo). Renamed to `CHROMA_API_KEY`. Added `CHROMA_DATABASE=DocuChat`.

---

### 2. `embeddings.py` using string literals instead of env vars
**File:** `src/rag_bot/indexing/embeddings.py`

Before:
```python
self.client = chromadb.CloudClient(
    api_key='CHROMA_API_KAY',
    tenant='CHROMA_TENANT',
    database='DocuChat'
)
```

After:
```python
self.client = chromadb.CloudClient(
    api_key=config.chroma_api_key,
    tenant=config.chroma_tenant,
    database=config.chroma_database
)
```

The API key and tenant were passed as plain strings instead of reading from environment variables via config. The chatbot was connecting with literal string values, not actual credentials.

---

### 3. `chromadb` package too old (v0.5.5 → v1.5.7)
**Action:** `pip install --upgrade chromadb`

ChromaDB Cloud deprecated the v1 REST API. The installed version (0.5.5) used the old API and returned:
```
410 Gone — The v1 API is deprecated. Please use /v2 apis
```

Upgrading to 1.5.7 resolved this.

---

### 4. `load_dotenv()` not finding the `.env` file
**File:** `src/rag_bot/config.py`

Before:
```python
load_dotenv()
```

`load_dotenv()` with no path searches upward from the current working directory. When running from the project root it found nothing, because `.env` lives at `src/rag_bot/.env`.

After:
```python
load_dotenv(Path(__file__).parent / ".env")
```

This uses an explicit absolute path relative to `config.py` itself, so it works regardless of where the process is started from.

---

### 5. Migration script `migrate_to_cloud.py`
**Action:** Written and executed to transfer local ChromaDB data to the cloud.

The local collection was named `chroma_db` (the old default name). The cloud target collection is `knowledge_base`. The script:
- Reads all 48 documents from the local `PersistentClient`
- Batches them in groups of 100
- Upserts each batch into the ChromaDB Cloud collection
- Converts numpy embedding arrays to plain Python lists (required by the cloud API)

---

### 6. Replaced `sentence-transformers` with Cohere Embed API
**File:** `src/rag_bot/indexing/embeddings.py`
**Branch:** `vercel-deploy` only

Removed:
```python
from sentence_transformers import SentenceTransformer
self.model = SentenceTransformer(config.embedding_model_name)
vectors = self.model.encode(texts, normalize_embeddings=True)
```

Added:
```python
import cohere
self.cohere_client = cohere.ClientV2(api_key=config.cohere_api_key)
response = self.cohere_client.embed(
    texts=texts,
    model=self.embed_model,
    input_type=input_type,   # "search_document" or "search_query"
    embedding_types=["float"]
)
```

**Why `input_type` matters:** Cohere's embedding model is asymmetric. Documents are embedded with `input_type="search_document"` and queries are embedded with `input_type="search_query"`. Using the wrong type at either end degrades retrieval quality.

This change eliminates `torch` (339 MB) and `transformers` (54 MB) from the dependency tree.

---

### 7. Removed Whisper from `api.py`
**File:** `src/api/api.py`
**Branch:** `vercel-deploy` only

Removed:
- `import whisper`
- `whisper_model = whisper.load_model("tiny")`
- The entire `/transcribe` endpoint

Whisper requires `torch`. Even though whisper itself is only ~2 MB, torch is ~339 MB. Removing whisper removes torch from the dependency tree entirely.

---

### 8. Fixed `StaticFiles` to use absolute path
**File:** `src/api/api.py`

Before:
```python
app.mount("/static", StaticFiles(directory="static"), name="static")
```

After:
```python
STATIC_DIR = Path(__file__).parents[2] / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
```

The relative path `"static"` resolves from wherever the process is launched. In Vercel's serverless environment the working directory is not guaranteed to be the project root. An absolute path derived from `__file__` is always correct.

---

### 9. Lazy initialization of `RetrievalChatCLI`
**File:** `src/api/api.py`

Before:
```python
chat_bot = RetrievalChatCLI()   # runs at import time
```

After:
```python
_chat_bot = None

def get_chat_bot() -> RetrievalChatCLI:
    global _chat_bot
    if _chat_bot is None:
        _chat_bot = RetrievalChatCLI()
    return _chat_bot
```

When Vercel detects the FastAPI entrypoint, it imports `main.py`. Module-level code runs at import time. `RetrievalChatCLI()` creates a `KnowledgeRetriever` which creates an `EmbeddingStore` which connects to ChromaDB Cloud and initializes the Cohere client — all of which require environment variables. During Vercel's build/detection phase those variables may not be available yet, causing the import to fail. Lazy initialization defers the connection until the first actual request, when all env vars are guaranteed to be present.

---

### 10. Added `sys.path` insertion to `main.py`
**File:** `main.py`

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
```

`from src.api.api import app` requires that the project root is in `sys.path` so Python can resolve the `src` package. Vercel does not guarantee this. Inserting the directory containing `main.py` (which is the project root) at position 0 ensures the import always resolves correctly.

---

### 11. Added missing `__init__.py` files
**Files:** `src/__init__.py`, `src/api/__init__.py`

Without these, `src` and `src/api` are not Python packages — they're just directories. The imports `from src.rag_bot...` and `from src.api.api import app` work locally because pytest adds `src` to `sys.path` via `pyproject.toml`. Vercel does not do this. Creating `__init__.py` in each directory makes them proper packages that Python can import from any working directory.

---

### 12. Root cause of `ModuleNotFoundError: No module named 'fastapi'`
**File:** `pyproject.toml`

This was the final and most important fix. The build log said:

```
Installing required dependencies from pyproject.toml...
```

Vercel's new Python runtime prefers `pyproject.toml` over `requirements.txt` when both exist. The original `pyproject.toml` had no `dependencies` section:

```toml
[project]
name="rag-bot"
version="0.1.0"
description="A RAG bot project"
requires-python=">=3.8"
```

So Vercel installed nothing. `requirements.txt` was silently ignored.

Fix — added the full dependency list:

```toml
[project]
name="rag-bot"
version="0.1.0"
description="A RAG bot project"
requires-python=">=3.12"
dependencies = [
    "fastapi==0.128.7",
    "uvicorn==0.34.3",
    "starlette==0.49.3",
    "pydantic==2.12.5",
    "pydantic-core==2.41.5",
    "python-dotenv==1.1.0",
    "python-multipart==0.0.20",
    "chromadb==1.5.7",
    "cohere==5.13.11",
]
```

---

### 13. Re-indexed documents with Cohere embeddings
**Collection:** `knowledge_base_cohere` (ChromaDB Cloud)

After switching the embedding model, all 48 existing document chunks had to be re-indexed. The old `knowledge_base` collection (sentence-transformers vectors) was left intact for the `main` branch. A new `knowledge_base_cohere` collection was created and populated by running:

```bash
PYTHONPATH=. python -c "from src.rag_bot.indexing.phase2_index import index; index()"
```

Result: 48 chunks indexed using `embed-english-v3.0`.

---

### 14. UI — welcome message and input placeholder
**File:** `static/index.html`

Two lines changed to tell visitors what the chatbot is about:

- **Welcome message:** now introduces Prashanna Raj Pandit and gives three example questions
- **Input placeholder:** changed from `"Query the knowledge base…"` to `"Ask about Prashanna — skills, projects, experience…"`

---

## Challenges and Considerations

### `pyproject.toml` takes priority over `requirements.txt`
Vercel's new Python runtime installs from `pyproject.toml` when it exists, silently ignoring `requirements.txt`. Always keep `pyproject.toml` dependencies in sync when both files are present.

### Embedding model incompatibility between branches
You cannot mix embeddings from different models in the same ChromaDB collection. If you ever switch models in either branch, you must re-index all documents into a fresh collection. Querying with the wrong model produces incorrect similarity scores and poor retrieval quality.

### Module-level initialization in serverless environments
Any code that runs at import time (outside a function) is executed during Vercel's detection/build phase. Network connections, file reads, and API calls should be deferred to request time using lazy initialization patterns.

### Vercel Python runtime version
Vercel uses the Python version specified in `pyproject.toml` (`requires-python`). Setting `>=3.8` tells Vercel it can use any version — it chose 3.12. It is better to pin `>=3.12` explicitly to match the runtime being used and avoid version-dependent behavior.

### Static file paths in serverless functions
Relative paths like `StaticFiles(directory="static")` depend on the working directory at runtime. In serverless environments the working directory is unpredictable. Always use absolute paths derived from `__file__`.

### Environment variables are not read from `.env` on Vercel
Vercel does not load `.env` files. All environment variables must be set manually in the Vercel dashboard under **Settings → Environment Variables**. The `load_dotenv()` call is silently ignored in the deployed environment — it only matters locally.

### The `builds` key vs the new Python runtime
The `builds` key in `vercel.json` triggers the older `@vercel/python` builder. Vercel's newer auto-detection runtime ignores it in some configurations, which caused conflicts. Removing `builds` and using `rewrites` lets the new runtime handle everything cleanly.

### ChromaDB local vs cloud collection names
The local ChromaDB collection was named `chroma_db` (the old default). The cloud collection is named `knowledge_base`. The `.env` variable `CHROMA_COLLECTION_NAME` controls which collection is used at runtime. Mismatching this value is a common source of "collection not found" errors.

---

## Environment Variables Reference

These must be set in Vercel dashboard for the `vercel-deploy` branch:

| Variable | Description |
|---|---|
| `COHERE_API_KEY` | Cohere API key for LLM and embeddings |
| `COHERE_MODEL` | LLM model ID (`command-r-plus-08-2024`) |
| `COHERE_EMBED_MODEL` | Embedding model (`embed-english-v3.0`) |
| `CHROMA_API_KEY` | ChromaDB Cloud API key |
| `CHROMA_TENANT` | ChromaDB Cloud tenant UUID |
| `CHROMA_DATABASE` | ChromaDB database name (`DocuChat`) |
| `CHROMA_COLLECTION_NAME` | Collection name (`knowledge_base_cohere`) |
| `TOP_K_RESULTS` | Number of chunks to retrieve (`12`) |
| `CHUNK_SIZE` | Token size per chunk (`1200`) |
| `CHUNK_OVERLAP` | Overlap between chunks (`200`) |

---

## Dependency Size Comparison

| Branch | Key Packages | Approx Size | Deployable on Vercel |
|---|---|---|---|
| `main` | torch + sentence-transformers + whisper | ~400 MB+ | No |
| `vercel-deploy` | fastapi + chromadb + cohere | ~15 MB | Yes |
