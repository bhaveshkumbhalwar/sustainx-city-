"""
Model management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Any

from app.schemas.predictions import ModelInfo, ModelStatus
from app.config import get_settings


router = APIRouter()
settings = get_settings()


# Model registry (in production, this would be a database)
MODEL_REGISTRY = {
    "bin_fill_prediction": {
        "name": "bin_fill_prediction",
        "version": "0.1.0-baseline",
        "status": ModelStatus.INSUFFICIENT_DATA,
        "description": "Smart bin fill level prediction using linear extrapolation baseline",
        "dataQuality": "INSUFFICIENT_DATA: Only 3 readings for 1 bin over 6.5 hours",
        "trainingDataPoints": 3,
        "timeSpanDays": 0.27,
    },
    "waste_classification": {
        "name": "waste_classification",
        "version": "0.1.0-transfer",
        "status": ModelStatus.INSUFFICIENT_DATA,
        "description": "Waste image classification using transfer learning (EfficientNet/MobileNet)",
        "dataQuality": "INSUFFICIENT_DATA: No training images available",
        "trainingDataPoints": 0,
        "timeSpanDays": 0,
    },
    "complaint_priority": {
        "name": "complaint_priority",
        "version": "0.1.0-hybrid",
        "status": ModelStatus.INSUFFICIENT_DATA,
        "description": "Complaint priority prediction using rule-based + ML hybrid",
        "dataQuality": "INSUFFICIENT_DATA: Only 1 labeled complaint out of 4 total",
        "trainingDataPoints": 1,
        "timeSpanDays": 0,
    },
    "hotspot_prediction": {
        "name": "hotspot_prediction",
        "version": "0.1.0-dbscan",
        "status": ModelStatus.INSUFFICIENT_DATA,
        "description": "Garbage hotspot prediction using DBSCAN geospatial clustering",
        "dataQuality": "INSUFFICIENT_DATA: No geo-tagged complaints available",
        "trainingDataPoints": 0,
        "timeSpanDays": 0,
    },
}


@router.get("", response_model=List[ModelInfo])
async def list_models():
    """List all registered models and their status"""
    return list(MODEL_REGISTRY.values())


@router.get("/{model_name}", response_model=ModelInfo)
async def get_model(model_name: str):
    """Get detailed information about a specific model"""
    if model_name not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    return MODEL_REGISTRY[model_name]


@router.get("/{model_name}/metrics", response_model=Dict[str, Any])
async def get_model_metrics(model_name: str):
    """Get detailed metrics for a model"""
    if model_name not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    
    model = MODEL_REGISTRY[model_name]
    return {
        "model": model_name,
        "metrics": {
            "status": model["status"],
            "trainingDataPoints": model["trainingDataPoints"],
            "timeSpanDays": model["timeSpanDays"],
            "dataQuality": model["dataQuality"],
        },
    }


@router.get("/{model_name}/versions")
async def get_model_versions(model_name: str):
    """List available model versions"""
    if model_name not in MODEL_REGISTRY:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    
    # In production, this would query a model registry
    return {
        "model": model_name,
        "versions": [
            {
                "version": MODEL_REGISTRY[model_name]["version"],
                "status": MODEL_REGISTRY[model_name]["status"],
                "createdAt": "2026-09-14T00:00:00Z",
                "isCurrent": True,
            }
        ],
    }