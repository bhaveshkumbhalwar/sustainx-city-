"""
ML model definitions and base classes
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel


class BaseModelConfig(BaseModel):
    """Base configuration for ML models"""
    name: str
    version: str
    description: str = ""
    hyperparameters: Dict[str, Any] = {}
    training_config: Dict[str, Any] = {}


class BasePredictor(ABC):
    """Abstract base class for all predictors"""
    
    def __init__(self, config: BaseModelConfig):
        self.config = config
        self.model = None
        self.is_trained = False
        self.last_trained: Optional[datetime] = None
        self.metrics: Dict[str, float] = {}
        self.data_quality: str = "UNKNOWN"
        self.training_data_points = 0
        self.time_span_days = 0.0
    
    @abstractmethod
    async def train(self, data: Any) -> Dict[str, float]:
        """Train the model and return metrics"""
        pass
    
    @abstractmethod
    async def predict(self, input_data: Any) -> Any:
        """Make predictions"""
        pass
    
    @abstractmethod
    def validate_input(self, input_data: Any) -> bool:
        """Validate input data"""
        pass
    
    def get_status(self) -> Dict[str, Any]:
        """Get model status information"""
        return {
            "name": self.config.name,
            "version": self.config.version,
            "is_trained": self.is_trained,
            "last_trained": self.last_trained.isoformat() if self.last_trained else None,
            "metrics": self.metrics,
            "data_quality": self.data_quality,
            "training_data_points": self.training_data_points,
            "time_span_days": self.time_span_days,
        }
    
    def _check_trained(self):
        if not self.is_trained:
            raise ValueError("Model is not trained")


class ModelArtifact(BaseModel):
    """Model artifact metadata"""
    model_name: str
    version: str
    path: str
    created_at: datetime
    metrics: Dict[str, float] = {}
    hyperparameters: Dict[str, Any] = {}
    training_data_hash: str = ""
    feature_names: List[str] = []
    target_name: str = ""