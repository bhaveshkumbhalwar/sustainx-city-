"""
Smart Bin Fill-Level Prediction Service

Uses simple baseline (linear extrapolation) as primary method since
data is insufficient for complex ML models.
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.schemas.predictions import (
    BinFillPredictionRequest,
    BinFillPredictionResponse,
    ModelStatus,
    HorizonMinutes,
)
from app.models.base import BasePredictor, BaseModelConfig
from app.config import get_settings


class BinFillConfig(BaseModelConfig):
    name: str = "bin_fill_prediction"
    version: str = "0.1.0"
    description: str = "Smart bin fill level prediction using time-series forecasting"


class FillPredictionInput(BaseModel):
    binId: str
    level: float
    timestamp: datetime
    temperature: Optional[float] = None
    signal: Optional[float] = None
    block: Optional[str] = None


class FillPredictionResult(BaseModel):
    binId: str
    currentFill: float
    predictions: Dict[str, float]
    predictionIntervals: Optional[Dict[str, List[float]]] = None
    horizonMinutes: List[int]
    modelVersion: str
    modelStatus: ModelStatus
    generatedAt: datetime
    dataQuality: str
    dataPoints: int
    timeSpanHours: float


class BinFillPredictor:
    """
    Smart Bin Fill-Level Predictor.
    
    Uses simple linear extrapolation as baseline since data is insufficient
    for complex ML models. Returns INSUFFICIENT_DATA status when data
    is inadequate for reliable predictions.
    """
    
    MIN_READINGS = 10
    MIN_TIME_SPAN_HOURS = 24
    MIN_BINS_WITH_DATA = 3
    
    def __init__(self):
        self.config = get_settings()
        self.model_version = "0.1.0-baseline"
        self.is_trained = False
        self.last_trained = None
        self.metrics = {}
        self.data_quality = "INSUFFICIENT_DATA"
        self.training_data_points = 0
        self.time_span_hours = 0.0
    
    async def predict(self, request) -> Dict[str, Any]:
        """
        Predict fill levels for specified horizons.
        
        Returns INSUFFICIENT_DATA if insufficient data for reliable prediction.
        """
        # Validate input
        if not request.readings:
            raise ValueError("No readings provided")
        
        # Filter readings for the requested bin
        bin_readings = [r for r in request.readings if r.binId == request.binId]
        
        if not bin_readings:
            raise ValueError(f"No readings found for bin {request.binId}")
        
        # Sort by timestamp
        bin_readings.sort(key=lambda r: r.timestamp)
        
        # Extract levels and timestamps
        levels = np.array([r.level for r in bin_readings])
        timestamps = np.array([r.timestamp.timestamp() for r in bin_readings])
        
        # Calculate data quality metrics
        data_points = len(bin_readings)
        if len(timestamps) > 1:
            time_span_hours = (timestamps[-1] - timestamps[0]) / 3600
        else:
            time_span_hours = 0
        
        # Check data sufficiency
        is_sufficient = (
            data_points >= self.MIN_READINGS and
            time_span_hours >= self.MIN_TIME_SPAN_HOURS
        )
        
        # Get current fill level
        current_fill = float(levels[-1]) if len(levels) > 0 else 0.0
        
        # Generate predictions
        predictions = {}
        intervals = {}
        
        for horizon in request.horizons:
            horizon_minutes = horizon.value
            prediction, interval = self._predict_horizon(
                levels, timestamps, horizon_minutes, current_fill
            )
            predictions[str(horizon_minutes)] = round(prediction, 1)
            
            # Add uncertainty interval (±15% for baseline)
            margin = max(5.0, current_fill * 0.15)
            intervals[str(horizon_minutes)] = [
                round(max(0, prediction - margin), 1),
                round(min(100, prediction + margin), 1)
            ]
        
        # Determine data quality
        if not is_sufficient:
            data_quality = "INSUFFICIENT_DATA"
            model_status = ModelStatus.INSUFFICIENT_DATA
        elif data_points < 50:
            data_quality = "LIMITED"
            model_status = ModelStatus.READY
        else:
            data_quality = "GOOD"
            model_status = ModelStatus.READY
        
        return {
            "binId": request.binId,
            "currentFill": round(current_fill, 1),
            "predictions": predictions,
            "predictionIntervals": intervals,
            "horizonMinutes": [h.value for h in request.horizons],
            "modelVersion": self.model_version,
            "modelStatus": model_status,
            "generatedAt": datetime.utcnow(),
            "dataQuality": data_quality,
            "dataPoints": data_points,
            "timeSpanHours": round(time_span_hours, 2),
        }
    
    def _predict_horizon(
        self, 
        levels: np.ndarray, 
        timestamps: np.ndarray, 
        horizon_minutes: int,
        current_fill: float
    ) -> tuple:
        """
        Predict fill level at horizon using linear extrapolation.
        
        Returns (prediction, interval)
        """
        if len(levels) < 2:
            # Not enough data for extrapolation, return current level
            return current_fill, [max(0, current_fill - 5), min(100, current_fill + 5)]
        
        # Linear regression on recent readings
        # Use last 5 readings or all available
        n = min(5, len(levels))
        recent_levels = levels[-n:]
        recent_times = timestamps[-n:]
        
        # Normalize times
        t_norm = (recent_times - recent_times[0]) / 3600  # hours
        
        # Linear regression
        if len(t_norm) >= 2 and np.std(t_norm) > 0:
            slope, intercept = np.polyfit(t_norm, recent_levels, 1)
            
            # Predict at horizon
            horizon_hours = horizon_minutes / 60
            t_future = t_norm[-1] + horizon_hours
            prediction = slope * t_future + intercept
            
            # Clamp to valid range
            prediction = np.clip(prediction, 0, 100)
        else:
            prediction = current_fill
        
        return float(prediction), []
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "name": "bin_fill_prediction",
            "version": self.model_version,
            "status": "INSUFFICIENT_DATA",
            "description": "Smart bin fill level prediction using linear extrapolation baseline",
            "dataQuality": "INSUFFICIENT_DATA: Only 3 readings for 1 bin over 6.5 hours",
            "trainingDataPoints": 3,
            "timeSpanDays": 0.27,
        }
    
    async def train(self, data) -> Dict[str, float]:
        """Train the model (placeholder for future ML models)"""
        # For baseline, no training needed
        self.is_trained = True
        self.last_trained = datetime.utcnow()
        self.metrics = {"baseline_mae": None}
        return self.metrics
    
    def validate_input(self, request) -> bool:
        """Validate prediction request"""
        if not request.readings:
            return False
        if not request.binId:
            return False
        return True