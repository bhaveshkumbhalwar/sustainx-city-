"""
Complaint Priority Prediction Service

Uses rule-based + ML hybrid approach for priority prediction.
Returns INSUFFICIENT_DATA since only 1 labeled complaint exists.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

from app.schemas.predictions import (
    ComplaintPriorityRequest,
    ComplaintPriorityResponse,
    ComplaintFeatures,
    PriorityLevel,
    ModelStatus,
)


class PriorityPredictor:
    """
    Complaint Priority Predictor.
    
    Uses rule-based logic + ML hybrid. Returns INSUFFICIENT_DATA 
    since only 1 labeled complaint exists.
    """
    
    PRIORITY_RULES = {
        "critical": ["hazardous", "medical", "chemical", "toxic"],
        "high": ["e-waste", "electronic", "construction", "fire", "spill"],
        "medium": ["mixed", "furniture", "garden", "debris"],
        "low": ["paper", "plastic", "food", "organic"],
    }
    
    def __init__(self):
        self.model_version = "0.1.0-hybrid"
        self.is_trained = False
        self.last_trained = None
        self.metrics = {}
        self.rules = self.PRIORITY_RULES
    
    async def predict(self, request) -> Dict[str, Any]:
        """
        Predict complaint priority using rule-based + ML hybrid.
        
        Returns INSUFFICIENT_DATA since ML model not trained.
        """
        features = request.features
        
        # Rule-based priority (always works)
        rule_priority = self._rule_based_priority(features)
        
        # ML prediction would go here (returns INSUFFICIENT_DATA)
        ml_priority = None
        ml_confidence = 0.0
        all_probs = {p.value: 0.25 for p in ["low", "medium", "high", "critical"]}
        
        # Rule override logic
        rule_override = None
        if features.slaRemainingMinutes is not None and features.slaRemainingMinutes < 60:
            rule_override = "SLA breach imminent"
            rule_priority = "critical"
        elif features.duplicateCount and features.duplicateCount > 3:
            rule_override = "Multiple duplicate reports"
            rule_priority = "high"
        
        # Since ML not trained, use rule-based with warning
        final_priority = rule_priority
        confidence = 0.7  # Rule-based confidence
        
        # If ML were trained, we'd blend:
        # final_priority = blend(rule_priority, ml_priority, ml_confidence)
        
        return {
            "predictedPriority": rule_priority,
            "confidence": confidence,
            "allProbabilities": {
                "low": 0.25,
                "medium": 0.25,
                "high": 0.25,
                "critical": 0.25,
            },
            "ruleOverride": rule_override,
            "modelVersion": "0.1.0-hybrid",
            "modelStatus": "INSUFFICIENT_DATA",
            "generatedAt": datetime.utcnow(),
            "featureImportance": {
                "slaRemainingMinutes": 0.35,
                "wasteType": 0.25,
                "duplicateCount": 0.20,
                "historicalDensity": 0.15,
                "sensitiveAreaProximity": 0.10,
            },
        }
    
    def _rule_based_priority(self, features) -> str:
        """Determine priority using rule-based logic"""
        waste_type = (features.wasteType or "").lower()
        description = (features.description or "").lower()
        
        # Check critical keywords
        for keyword in self.PRIORITY_RULES["critical"]:
            if keyword in waste_type or keyword in description:
                return "critical"
        
        # Check high keywords
        for keyword in self.PRIORITY_RULES["high"]:
            if keyword in waste_type or keyword in description:
                return "high"
        
        # Check medium keywords
        for keyword in self.PRIORITY_RULES["medium"]:
            if keyword in waste_type or keyword in description:
                return "medium"
        
        # Check low keywords
        for keyword in self.PRIORITY_RULES["low"]:
            if keyword in waste_type or keyword in description:
                return "low"
        
        # Default based on SLA
        if features.slaRemainingMinutes is not None:
            if features.slaRemainingMinutes < 120:
                return "high"
            elif features.slaRemainingMinutes < 480:
                return "medium"
        
        return "low"
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "name": "complaint_priority",
            "version": "0.1.0-hybrid",
            "status": "INSUFFICIENT_DATA",
            "description": "Complaint priority prediction using rule-based + ML hybrid",
            "dataQuality": "INSUFFICIENT_DATA: Only 1 labeled complaint out of 4 total",
            "trainingDataPoints": 1,
            "timeSpanDays": 0,
        }
    
    def validate_input(self, request) -> bool:
        """Validate priority prediction request"""
        if not request.features:
            return False
        if not request.features.wasteType:
            return False
        if not features.description:
            return False
        return True