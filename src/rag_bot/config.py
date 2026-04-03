from __future__ import annotations
import os
from dotenv import load_dotenv
from pathlib import Path
from dataclasses import dataclass, field

load_dotenv()

ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Config:
    pdf_dir: Path = Path(os.getenv("PDF_DIR", "data/raw/pdfs"))
    output_dir: Path = Path(os.getenv("OUTPUT_PHASE1", "data/phase1_ingestion"))

    # llm
    cohere_api_key: str = str(os.getenv("COHERE_API_KEY"))
    cohere_model: str = os.getenv("COHERE_MODEL")

    chunk_size: int = int(os.getenv("CHUNK_SIZE", "1200"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "200"))
    phase1_document_path: Path = ROOT / "data/processed/phase1_ingestion.jsonl"
    phase2_chunks_path: Path = ROOT / "data/processed/phase2_chunking.jsonl"

    chroma_dir: Path = ROOT / "data/chroma_db"

    phase3_output_dir: Path = ROOT / "output"

    top_k_results: int = int(os.getenv("TOP_K_RESULTS", "12"))
    chroma_collection_name: str = os.getenv("CHROMA_COLLECTION_NAME", "knowledge_base")
    embedding_model_name: str = os.getenv("EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")

    def ensure_dirs(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.pdf_dir.mkdir(parents=True, exist_ok=True)
        self.chroma_dir.mkdir(parents=True, exist_ok=True)
        self.phase3_output_dir.mkdir(parents=True, exist_ok=True)


config = Config()
