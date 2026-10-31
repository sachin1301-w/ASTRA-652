from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.6-flash"
    sarvam_ai_api_key: str = ""
    frontend_url: str = "http://localhost:5173"

    # Cognee - AI memory/knowledge-graph layer for cross-document financial retrieval.
    # cognee_mode="local" (default) keeps everything on this machine, reusing
    # the Gemini key/provider above so no second API key is required.
    # cognee_mode="cloud" instead connects to a Cognee Cloud tenant - an
    # explicit opt-in to an external service, using COGNEE_CLOUD_URL + the
    # same COGNEE_API_KEY for auth.
    cognee_enabled: bool = True
    cognee_mode: str = "local"
    cognee_cloud_url: str = ""
    cognee_api_key: str = ""
    cognee_llm_provider: str = "gemini"
    cognee_llm_model: str = "gemini-3.5-flash-lite"
    cognee_embedding_provider: str = "gemini"
    cognee_embedding_model: str = "gemini-embedding-001"
    cognee_data_path: str = "data/cognee_storage"

    # Convai 3D Conversational Avatar Configuration
    convai_experience_id: str = ""
    convai_character_id: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def resolved_convai_character_id(self) -> str:
        import os
        return (
            self.convai_character_id
            or os.getenv("CONVAI_CHARACTER_ID", "")
            or os.getenv("VITE_CONVAI_CHARACTER_ID", "")
        ).strip()

    @property
    def resolved_convai_experience_id(self) -> str:
        import os
        return (
            self.convai_experience_id
            or os.getenv("CONVAI_EXPERIENCE_ID", "")
            or os.getenv("VITE_CONVAI_EXPERIENCE_ID", "")
            or self.resolved_convai_character_id
        ).strip()

    @property
    def cognee_llm_api_key(self) -> str:
        """The default "gemini" provider always uses the proven-working
        GEMINI_API_KEY, regardless of whether COGNEE_API_KEY is also set - the
        pasted COGNEE_API_KEY didn't match a recognized Gemini key format and
        broke authentication when it took precedence. COGNEE_API_KEY only
        applies once COGNEE_LLM_PROVIDER is changed to a different provider."""
        if self.cognee_llm_provider == "gemini":
            return self.gemini_api_key
        return self.cognee_api_key or self.gemini_api_key

    @property
    def cors_origins(self) -> list[str]:
        if not self.frontend_url:
            return ["*"]
        origins = [u.strip() for u in self.frontend_url.split(",") if u.strip()]
        if "http://localhost:5173" not in origins:
            origins.append("http://localhost:5173")
        return origins


settings = Settings()
