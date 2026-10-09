"""
Health check endpoints
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any

from app.config import get_settings


router = APIRouter()
settings = get_settings()


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    checks: Dict[str, Any]


class ModelStatus(BaseModel):
    name: str
    version: str
    status: str
    last_trained: str = ""
    metrics: Dict[str, float] = {}


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Basic health check"""
    return HealthResponse(
        status="healthy",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        checks={
            "api": "ok",
            "database": "ok",  # TODO: actual DB check
            "models": "ok",
        },
    )


@router.get("/health/models", response_model=Dict[str, ModelStatus])
async def models_health():
    """Model health status"""
    return {
        "bin_fill_prediction": ModelStatus(
            name="bin_fill_prediction",
            version="0.1.0",
            status="INSUFFICIENT_DATA",
            last_trained="never",
            metrics={},
        ),
        "waste_classification": ModelStatus(
            name="waste_classification",
            version="0.1.0",
            status="INSUFFICIENT_DATA",
            last_trained="never",
            metrics={},
        ),
        "complaint_priority": ModelStatus(
            name="complaint_priority",
            version="0.1.0",
            status="INSUFFICIENT_DATA",
            last_trained="never",
            metrics={},
        ),
        "hotspot_prediction": ModelStatus(
            name="hotspot_prediction",
            version="0.1.0",
            status="INSUFFICIENT_DATA",
            last_trained="never",
            metrics={},
        ),
    }


@router.get("/ready")
async def readiness():
    """Kubernetes readiness probe"""
    return {"status": "ready"}


@router.get("/live")
async def liveness():
    """Kubernetes liveness probe"""
    return {"status": "alive"}