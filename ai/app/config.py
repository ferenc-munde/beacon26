from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str
    oracle_model: str = "gpt-4o-mini"
    oracle_max_tokens: int = 300

    class Config:
        env_file = ".env"


settings = Settings()
