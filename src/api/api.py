import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.responses import FileResponse
from src.rag_bot.chat_cli import RetrievalChatCLI

app = FastAPI(title="RAG chatbot")
app.mount("/static", StaticFiles(directory="static"), name="static")


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def serve_ui():
    return FileResponse("static/index.html")


@app.post("/chat")
async def chat(req: ChatRequest):
    print(req)
    chat_bot = RetrievalChatCLI()
    response, evidence_count = chat_bot.communicate_api(req.message)
    print(response)
    print(evidence_count)
    return {
        "answer": response,
        "evidence_count": evidence_count
    }
