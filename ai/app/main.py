from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field


class InferenceRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    mode: Literal["test", "play", "default"] = "default"


class InferenceResponse(BaseModel):
    mode: str
    result: str
    confidence: float


app = FastAPI(title="Beacon26 AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/infer", response_model=InferenceResponse)
def infer(payload: InferenceRequest) -> InferenceResponse:
    # Placeholder AI behavior for scaffolding and integration testing.
    normalized = payload.prompt.strip().lower()

    if "hint" in normalized:
        result = "Try exploring the edges of the board first."
        confidence = 0.74
    elif "stuck" in normalized:
        result = "Coordinate with teammates and move one cursor at a time."
        confidence = 0.68
    else:
        result = "Signal received. AI scaffolding is active."
        confidence = 0.51

    return InferenceResponse(mode=payload.mode, result=result, confidence=confidence)
