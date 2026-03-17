#!/usr/bin/env bash
# script to run FastAPI server locally
echo"Starting RAG Bot API server..."
uvicorn src.api.api:app --host 127.0.0.1 --port 8000 --reload
