"""
Services package
"""
from app.services.bin_fill import BinFillPredictor
from app.services.waste_classifier import WasteClassifier
from app.services.priority_predictor import PriorityPredictor
from app.services.hotspot_predictor import HotspotPredictor

__all__ = [
    "BinFillPredictor",
    "WasteClassifier", 
    "PriorityPredictor",
    "HotspotPredictor",
]