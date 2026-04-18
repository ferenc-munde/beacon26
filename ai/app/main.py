from fastapi import FastAPI

from .models import OracleRequest, OracleResponse
from .oracle import ask_oracle

app = FastAPI(title="Beacon26 AI Service", version="0.2.0")

# end poin ts
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/oracle", response_model=OracleResponse)
def oracle(payload: OracleRequest) -> OracleResponse:
    return ask_oracle(payload)
