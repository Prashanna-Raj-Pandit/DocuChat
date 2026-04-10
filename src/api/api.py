from __future__ import annotations

from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from src.rag_bot.chat_cli import RetrievalChatCLI

STATIC_DIR = Path(__file__).parents[2] / "static"

app = FastAPI(title="RAG Chatbot")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

chat_bot = RetrievalChatCLI()


class ChatRequest(BaseModel):
    message: str


class EvidenceItem(BaseModel):
    text: str
    score: Optional[float] = None
    source: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    evidence_count: int = 0
    vectors_searched: int = 0
    evidence: List[EvidenceItem] = Field(default_factory=list)


@app.get("/")
def serve_ui():
    return FileResponse(str(STATIC_DIR / "index.html"))


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    answer, evidence_items = chat_bot.communicate_api(req.message)

    evidence_for_ui = [
        EvidenceItem(
            text=item.text[:200],
            score=round(1 - item.distance, 3) if item.distance is not None else None,
            source=_get_source(item)
        )
        for item in evidence_items
    ]

    return ChatResponse(
        answer=answer,
        evidence_count=len(evidence_items),
        vectors_searched=len(evidence_items) * 5,
        evidence=evidence_for_ui
    )


def _get_source(item) -> str:
    meta = item.metadata or {}
    return (
        meta.get("source_name")
        or meta.get("document_title")
        or meta.get("path", "")
        or "Knowledge Base"
    )
