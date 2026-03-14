from src.rag_bot.config import config
from src.rag_bot.indexing.embeddings import EmbeddingStore
from .chunker import DocumentChunker
from src.rag_bot.utils import read_jsonl,write_jsonl
from src.rag_bot.model import DocumentRecord

def index():
    phase1_path=config.phase1_document_path

    print(f"[INFO] Reading phase 1 documents from {phase1_path}")
    documents=read_jsonl(path=phase1_path,model_cls=DocumentRecord)
    print(f"[INFO] Documents Loaded: {len(documents)}")
    document_chunker=DocumentChunker()
    chunks=document_chunker.chunk_documents(documents)
    print(f"[INFO] Chunks created: {len(chunks)}")

    write_jsonl(path=config.phase2_chunks_path,records=chunks)
    print(f"[INFO] Chunk file written: {config.phase2_chunks_path}")

    embedding=EmbeddingStore()
    embedding.index_chunk(chunks)
    print(f"[INFO] Chunks indexed into ChromaDB at: {config.chroma_dir}")
    print(f"[INFO] Collection name: {config.chroma_collection_name}")

    return {
        "success": True,
        "stage": "Phase 2- Embedding and Vector store",
        "phase_1_input path":config.phase1_document_path,
        "phase_2_output path": config.phase2_chunks_path,
        "chunks_created": len(chunks),
        "chroma_dir": str(config.chroma_dir),
        "collection_name":str(config.chroma_collection_name),
    }


if __name__=="__main__":
    index()