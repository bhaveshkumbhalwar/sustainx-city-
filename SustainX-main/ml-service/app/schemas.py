"""Typed request/response schemas for the SustainX ML service (pydantic v2).

Malformed inputs are rejected with 422 before any inference happens.
No calibrated confidence exists for any model: uncertainty is expressed
exclusively as prediction intervals, never as invented percentages.
"""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ReadingIn(BaseModel):
    readAt: datetime
    level: float = Field(ge=0, le=100)
    temperature: Optional[float] = None
    signal: Optional[float] = None


class BinFillPredictRequest(BaseModel):
    binId: str = Field(min_length=1, max_length=64)
    readings: List[ReadingIn] = Field(min_length=4, max_length=500)
    horizonMinutes: Literal[120] = 120

    @field_validator('readings')
    @classmethod
    def readings_ordered(cls, v):
        times = [r.readAt for r in v]
        if any(b < a for a, b in zip(times, times[1:])):
            raise ValueError('readings must be ordered by readAt ascending')
        return v


class PredictionInterval(BaseModel):
    lo: float
    hi: float


class BinFillPredictResponse(BaseModel):
    binId: str
    currentFill: float
    predictedFill: float
    horizonMinutes: int
    predictionInterval: PredictionInterval
    modelVersion: str
    generatedAt: datetime
    expiresAt: datetime


class UnavailableResponse(BaseModel):
    status: Literal['INSUFFICIENT_DATA', 'MODEL_NOT_AVAILABLE'] = 'INSUFFICIENT_DATA'
    detail: str
    model: str
