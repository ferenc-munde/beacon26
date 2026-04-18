from typing import Literal

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class OracleRequest(BaseModel):
    puzzle_id: int = Field(ge=1, le=5)
    puzzle_state: dict
    hint_count: int = Field(ge=0)
    question: str = Field(min_length=1, max_length=500)
    question_type: Literal["hint", "free"]
    conversation_history: list[ConversationMessage] = []


class OracleResponse(BaseModel):
    message: str
    hint_tier: int
