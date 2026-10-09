"""
Prediction endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Any
from datetime import datetime

from app.schemas.predictions import (
    BinFillPredictionRequest,
    BinFillPredictionResponse,
    WasteClassificationRequest,
    WasteClassificationResponse,
    ComplaintPriorityRequest,
    ComplaintPriorityResponse,
    HotspotPredictionRequest,
    HotspotPredictionResponse,
    ModelInfo,
    ModelStatus,
    ErrorResponse,
)
from app.services.bin_fill import BinFillPredictor
from app.services.waste_classifier import WasteClassifier
from app.services.priority_predictor import PriorityPredictor
from app.services.hotspot_predictor import HotspotPredictor
from app.config import get_settings


router = APIRouter()
settings = get_settings()

# Initialize predictors (lazy-loaded)
_bin_predictor = None
_waste_classifier = None
_priority_predictor = None
_hotspot_predictor = None


def get_bin_predictor() -> BinFillPredictor:
    global _bin_predictor
    if _bin_predictor is None:
        _bin_predictor = BinFillPredictor()
    return _bin_predictor


def get_waste_classifier() -> WasteClassifier:
    global _waste_classifier
    if _waste_classifier is None:
        _waste_classifier = WasteClassifier()
    return _waste_classifier


def get_priority_predictor() -> PriorityPredictor:
    global _priority_predictor
    if _priority_predictor is None:
        _priority_predictor = PriorityPredictor()
    return _priority_predictor


def get_hotspot_predictor() -> HotspotPredictor:
    global _hotspot_predictor
    if _hotspot_predictor is None:
        _hotspot_predictor = HotspotPredictor()
    return _hotspot_predictor


@router.post(
    "/predict/bin-fill",
    response_model=BinFillPredictionResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def predict_bin_fill(
    request: BinFillPredictionRequest,
    predictor: BinFillPredictor = Depends(get_bin_predictor),
):
    """
    Predict future fill levels for a smart bin.
    
    Returns predictions for specified horizons with uncertainty intervals.
    Returns INSUFFICIENT_DATA status if insufficient training data exists.
    """
    try:
        result = await predictor.predict(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Prediction service unavailable: {str(e)}",
        )


@router.post(
    "/predict/waste-classification",
    response_model=WasteClassificationResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def classify_waste(
    request: WasteClassificationRequest,
    classifier: WasteClassifier = Depends(get_waste_classifier),
):
    """
    Classify waste type from image.
    
    Returns classification with confidence scores.
    Returns INSUFFICIENT_DATA if model not trained.
    """
    try:
        result = await classifier.predict(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Classification service unavailable: {str(e)}",
        )


@router.post(
    "/predict/complaint-priority",
    response_model=ComplaintPriorityResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def predict_complaint_priority(
    request: ComplaintPriorityRequest,
    predictor: PriorityPredictor = Depends(get_priority_predictor),
):
    """
    Predict complaint priority based on features.
    
    Returns priority with confidence and rule override info.
    Returns INSUFFICIENT_DATA if model not trained.
    """
    try:
        result = await predictor.predict(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Priority prediction unavailable: {str(e)}",
        )


@router.post(
    "/predict/hotspots",
    response_model=HotspotPredictionResponse,
    responses={
        400: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
    },
)
async def predict_hotspots(
    request: HotspotPredictionRequest,
    predictor: HotspotPredictor = Depends(get_hotspot_predictor),
):
    """
    Predict garbage hotspots for specified wards.
    
    Returns risk scores and predicted complaint counts per ward.
    Returns INSUFFICIENT_DATA if model not trained.
    """
    try:
        result = await predictor.predict(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Hotspot prediction unavailable: {str(e)}",
        )


@router.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all available models and their status"""
    return [
        {
            "name": "bin_fill_prediction",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Smart bin fill level prediction using time-series forecasting",
            "dataQuality": "INSUFFICIENT_DATA: Only 3 readings for 1 bin over 6.5 hours",
            "trainingDataPoints": 3,
            "timeSpanDays": 0.27,
        },
        {
            "name": "waste_classification",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Waste image classification using transfer learning",
            "dataQuality": "INSUFFICIENT_DATA: No training images available",
            "trainingDataPoints": 0,
            "timeSpanDays": 0,
        },
        {
            "name": "complaint_priority",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Complaint priority prediction from features",
            "dataQuality": "INSUFFICIENT_DATA: Only 1 labeled complaint out of 4 total",
            "trainingDataPoints": 1,
            "timeSpanDays": 0,
        },
        {
            "name": "hotspot_prediction",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Garbage hotspot prediction using geospatial analysis",
            "dataQuality": "INSUFFICIENT_DATA: No geo-tagged complaints available",
            "trainingDataPoints": 0,
            "timeSpanDays": 0,
        },
    ]


@router.get("/models/{model_name}", response_model=ModelInfo)
async def get_model(model_name: str):
    """Get detailed information about a specific model"""
    models = {
        "bin_fill_prediction": {
            "name": "bin_fill_prediction",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Smart bin fill level prediction using time-series forecasting",
            "dataQuality": "INSUFFICIENT_DATA: Only 3 readings for 1 bin over 6.5 hours",
            "trainingDataPoints": 3,
            "timeSpanDays": 0.27,
        },
        "waste_classification": {
            "name": "waste_classification",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Waste image classification using transfer learning",
            "dataQuality": "INSUFFICIENT_DATA: No training images available",
            "trainingDataPoints": 0,
            "timeSpanDays": 0,
        },
        "complaint_priority": {
            "name": "complaint_priority",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Complaint priority prediction from features",
            "dataQuality": "INSUFFICIENT_DATA: Only 1 labeled complaint out of 4 total",
            "trainingDataPoints": 1,
            "timeSpanDays": 0,
        },
        "hotspot_prediction": {
            "name": "hotspot_prediction",
            "version": "0.1.0",
            "status": ModelStatus.INSUFFICIENT_DATA,
            "description": "Garbage hotspot prediction using geospatial analysis",
            "dataQuality": "INSUFFICIENT_DATA: No geo-tagged complaints available",
            "trainingDataPoints": 0,
            "timeSpanDays": 0,
        },
    }
    
    if model_name not in models:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    
    return models[model_name]