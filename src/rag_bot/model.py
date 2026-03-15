from __future__ import annotations
from typing import List, Any
from pydantic import BaseModel, Field


class DocumentRecord(BaseModel):
    doc_id: str
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChunkRecord(BaseModel):
    chunk_id: str
    parent_doc_id: str
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class RetrieveEvidence(BaseModel):
    chunk_id: str
    distance: float
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    query_used: str = ""
