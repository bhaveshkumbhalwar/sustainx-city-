"""
ML Service Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Service
    SERVICE_NAME: str = "sustainx-ml"
    SERVICE_VERSION: str = "0.1.0"
    DEBUG: bool = False
    
    # API
    API_PREFIX: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    
    # MongoDB
    MONGO_URI: str = "mongodb://127.0.0.1:27017/sustainx"
    
    # ML Models
    MODEL_DIR: str = "/app/artifacts"
    MODEL_VERSION: str = "0.1.0"
    
    # External API
    NODE_API_URL: str = "http://localhost:5000/api"
    NODE_API_TIMEOUT: float = 30.0
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds
    
    # Timeouts
    INFERENCE_TIMEOUT: float = 10.0
    TRAINING_TIMEOUT: float = 300.0
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()