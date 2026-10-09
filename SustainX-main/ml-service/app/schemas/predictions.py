"""
Prediction request/response schemas
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ModelStatus(str, Enum):
    """Model availability status"""
    READY = "READY"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    ERROR = "ERROR"
    TRAINING = "TRAINING"


class HorizonMinutes(int, Enum):
    """Supported prediction horizons"""
    M30 = 30
    H1 = 60
    H2 = 120
    H6 = 360
    H12 = 720
    H24 = 1440


# Bin Fill Prediction
class BinReadingInput(BaseModel):
    binId: str = Field(..., description="Bin identifier")
    level: float = Field(..., ge=0, le=100, description="Current fill level percentage")
    timestamp: datetime = Field(..., description="Reading timestamp (ISO 8601)")
    temperature: Optional[float] = Field(None, description="Temperature in Celsius")
    signal: Optional[float] = Field(None, description="Signal strength")
    block: Optional[str] = Field(None, description="Ward/block code")


class BinFillPredictionRequest(BaseModel):
    binId: str = Field(..., description="Bin identifier")
    readings: List[BinReadingInput] = Field(..., min_length=1, max_length=1000)
    horizons: List[HorizonMinutes] = Field(default=[HorizonMinutes.H1, HorizonMinutes.H6, HorizonMinutes.H24])


class BinFillPredictionResponse(BaseModel):
    binId: str
    currentFill: float
    predictions: Dict[str, float] = Field(description="Predicted fill level for each horizon (minutes -> fill%)")
    predictionIntervals: Optional[Dict[str, List[float]]] = Field(
        default=None, description="Prediction intervals [lower, upper] for each horizon"
    )
    horizonMinutes: List[int]
    modelVersion: str
    modelStatus: ModelStatus
    generatedAt: datetime = Field(default_factory=datetime.utcnow)
    dataQuality: str = Field(description="Data quality assessment")
    dataPoints: int = Field(description="Number of data points used")
    timeSpanHours: float = Field(description="Time span of training data in hours")


# Waste Classification
class WasteClass(str, Enum):
    ORGANIC = "organic"
    PLASTIC = "plastic"
    PAPER = "paper"
    GLASS = "glass"
    METAL = "metal"
    E_WASTE = "e_waste"
    TEXTILE = "textile"
    MIXED = "mixed"
    OTHER = "other"


class WasteClassificationRequest(BaseModel):
    imageBase64: str = Field(..., description="Base64 encoded image")
    metadata: Optional[Dict[str, Any]] = None


class WasteClassificationPrediction(BaseModel):
    className: WasteClass
    confidence: float = Field(ge=0, le=1)
    allProbabilities: Dict[str, float]


class WasteClassificationResponse(BaseModel):
    predictions: List[WasteClassificationPrediction]
    modelVersion: str
    modelStatus: ModelStatus
    generatedAt: datetime = Field(default_factory=datetime.utcnow)
    processingTimeMs: float


# Complaint Priority
class PriorityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ComplaintFeatures(BaseModel):
    complaintType: str
    wasteType: str
    description: str
    block: str
    ward: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: datetime
    historicalDensity: Optional[float] = None
    duplicateCount: Optional[int] = 0
    slaRemainingMinutes: Optional[int] = None
    sensitiveAreaProximity: Optional[float] = None
    binFillLevel: Optional[float] = None


class ComplaintPriorityRequest(BaseModel):
    features: ComplaintFeatures


class ComplaintPriorityResponse(BaseModel):
    predictedPriority: PriorityLevel
    confidence: float = Field(ge=0, le=1)
    allProbabilities: Dict[str, float]
    ruleOverride: Optional[str] = None
    modelVersion: str
    modelStatus: ModelStatus
    generatedAt: datetime = Field(default_factory=datetime.utcnow)
    featureImportance: Optional[Dict[str, float]] = None


# Hotspot Prediction
class HotspotRiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class HotspotPredictionRequest(BaseModel):
    ward: Optional[str] = None
    zone: Optional[str] = None
    timeHorizonHours: int = Field(default=24, ge=1, le=168)
    includeHistorical: bool = True


class HotspotPrediction(BaseModel):
    ward: str
    zone: str
    riskScore: float = Field(ge=0, le=1)
    riskLevel: HotspotRiskLevel
    predictedComplaints: int
    contributingFactors: List[str]
    confidence: float = Field(ge=0, le=1)


class HotspotPredictionResponse(BaseModel):
    hotspots: List[HotspotPrediction]
    modelVersion: str
    modelStatus: ModelStatus
    generatedAt: datetime = Field(default_factory=datetime.utcnow)
    timeHorizonHours: int
    dataQuality: str


# Generic responses
class ErrorResponse(BaseModel):
    error: str
    message: str
    code: str
    details: Optional[Dict[str, Any]] = None


class ModelInfo(BaseModel):
    name: str
    version: str
    status: ModelStatus
    lastTrained: Optional[str] = None
    metrics: Dict[str, float] = {}
    description: str = ""
    dataQuality: str = ""
    trainingDataPoints: int = 0
    timeSpanDays: float = 0.0