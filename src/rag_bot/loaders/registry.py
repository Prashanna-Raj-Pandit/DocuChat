from typing import Any
from src.rag_bot.config import config
from .pdf_loader import PDFIngestor
from src.rag_bot.utils import write_jsonl


def phase1_ingestion() -> dict[str, Any]:
    config.ensure_dirs()
    all_records = []

    pdf_ingestor = PDFIngestor()
    pdf_records = pdf_ingestor.ingest_directory(config.pdf_dir)
    print(f"[INFO] PDF records collected: {len(pdf_records)}")

    all_records.extend(pdf_records)
    write_jsonl(config.phase1_document_path, all_records)

    return {
        "success": True,
        "stage": "Phase 1-Ingestion",
        "output_path": str(config.phase1_document_path),
        "total_records": len(all_records),
        "pdf_records": pdf_records,
    }


if __name__ == "__main__":
    result = phase1_ingestion()
    print(result)
