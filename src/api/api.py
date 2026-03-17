import os
import tempfile
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import whisper

from src.rag_bot.chat_cli import RetrievalChatCLI

app = FastAPI(title="RAG Chatbot")
app.mount("/static", StaticFiles(directory="static"), name="static")

chat_bot = RetrievalChatCLI()
whisper_model = whisper.load_model("tiny")


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
    return FileResponse("static/index.html")


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


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Receives audio blob from browser, Whisper transcribes it, returns text."""
    contents = await audio.read()

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    result = whisper_model.transcribe(tmp_path)
    os.remove(tmp_path)

    return {"transcript": result["text"].strip()}


def _get_source(item) -> str:
    meta = item.metadata or {}
    return (
            meta.get("source_name")
            or meta.get("document_title")
            or meta.get("path", "")
            or "Knowledge Base"
    )
