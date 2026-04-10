from __future__ import annotations

from typing import Any

import chromadb
import cohere

from src.rag_bot.config import config
from chromadb.api.models.Collection import Collection
from src.rag_bot.model import ChunkRecord


class EmbeddingStore:
    def __init__(self) -> None:
        self.cohere_client = cohere.ClientV2(api_key=config.cohere_api_key)
        self.embed_model = config.cohere_embed_model
        self.client = chromadb.CloudClient(
            api_key=config.chroma_api_key,
            tenant=config.chroma_tenant,
            database=config.chroma_database
        )
        self.collection: Collection = self.client.get_or_create_collection(
            name=config.chroma_collection_name,
            metadata={"description": "RAG chatbot knowledge base"}
        )

    def embed_texts(self, texts: list[str], input_type: str = "search_query") -> list[list[float]]:
        response = self.cohere_client.embed(
            texts=texts,
            model=self.embed_model,
            input_type=input_type,
            embedding_types=["float"]
        )
        return response.embeddings.float_

    @staticmethod
    def _normalize_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
        normalized: dict[str, Any] = {}
        for key, value in metadata.items():
            if isinstance(value, (str, int, float, bool)) or value is None:
                normalized[key] = value
            else:
                normalized[key] = str(value)
        return normalized

    def index_chunk(self, chunks: list[ChunkRecord], batch_size: int = 64) -> None:
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start:start + batch_size]
            ids = [chunk.chunk_id for chunk in batch]
            docs = [chunk.text for chunk in batch]
            metadata = [self._normalize_metadata(chunk.metadata) for chunk in batch]
            embeddings = self.embed_texts(docs, input_type="search_document")

            self.collection.upsert(
                ids=ids,
                documents=docs,
                metadatas=metadata,
                embeddings=embeddings
            )

    def query(self, query_text: str, top_k: int = config.top_k_results, where: dict[str, Any] | None = None) -> dict[
            str, Any]:
        query_embeddings = self.embed_texts([query_text], input_type="search_query")[0]
        return self.collection.query(
            query_embeddings=[query_embeddings],
            n_results=top_k,
            where=where
        )
