"""
Training endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

from app.config import get_settings


router = APIRouter()
settings = get_settings()


class TrainingRequest(BaseModel):
    modelName: str = Field(..., description="Name of model to train")
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    trainingDataPath: Optional[str] = None
    validationSplit: float = Field(default=0.15, ge=0.1, le=0.3)
    testSplit: float = Field(default=0.15, ge=0.1, le=0.3)
    forceRetrain: bool = False


class TrainingResponse(BaseModel):
    jobId: str
    modelName: str
    status: str
    startedAt: datetime
    estimatedDurationMinutes: int


class TrainingStatusResponse(BaseModel):
    jobId: str
    modelName: str
    status: str  # pending, running, completed, failed
    progress: float
    metrics: Dict[str, float] = {}
    startedAt: datetime
    completedAt: Optional[datetime] = None
    error: Optional[str] = None


# In-memory job store (use Redis/database in production)
TRAINING_JOBS: Dict[str, Dict] = {}


router = APIRouter()


@router.post("", response_model=TrainingResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_training(request: TrainingRequest):
    """Start a training job for a model"""
    # Validate model exists
    valid_models = ["bin_fill_prediction", "waste_classification", "complaint_priority", "hotspot_prediction"]
    if request.modelName not in valid_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model: {request.modelName}. Valid models: {valid_models}"
        )
    
    # Check if already training
    for job in TRAINING_JOBS.values():
        if job["modelName"] == request.modelName and job["status"] in ["pending", "running"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Training already in progress for {request.modelName}",
            )
    
    # Create job
    job_id = f"train_{request.model_name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    job = {
        "jobId": job_id,
        "modelName": request.modelName,
        "status": "pending",
        "progress": 0.0,
        "metrics": {},
        "startedAt": datetime.utcnow(),
        "completedAt": None,
        "error": None,
        "hyperparameters": request.hyperparameters,
    }
    TRAINING_JOBS[job_id] = job
    
    # Start training in background (simplified)
    # In production: use Celery, RQ, or similar task queue
    import asyncio
    asyncio.create_task(_run_training(job_id, request))
    
    return TrainingResponse(
        jobId=job_id,
        modelName=request.modelName,
        status="pending",
        startedAt=datetime.utcnow(),
        estimatedDurationMinutes=15,
    )


@router.get("/jobs", response_model=List[TrainingStatusResponse])
async def list_training_jobs():
    """List all training jobs"""
    return list(TRAINING_JOBS.values())


@router.get("/jobs/{job_id}", response_model=TrainingStatusResponse)
async def get_training_job(job_id: str):
    """Get training job status"""
    if job_id not in TRAINING_JOBS:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TRAINING_JOBS[job_id]


@router.delete("/jobs/{job_id}")
async def cancel_training_job(job_id: str):
    """Cancel a training job"""
    if job_id not in TRAINING_JOBS:
        raise HTTPException(status_code=404, detail="Training job not found")
    
    job = TRAINING_JOBS[job_id]
    if job["status"] in ["completed", "failed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed/failed job")
    
    job["status"] = "cancelled"
    job["completedAt"] = datetime.utcnow()
    return {"message": "Training job cancelled", "jobId": job_id}


async def _run_training(job_id: str, request: TrainingRequest):
    """Background training task"""
    job = TRAINING_JOBS[job_id]
    job["status"] = "running"
    job["progress"] = 0.1
    
    try:
        # Simulate training stages
        stages = [
            ("Loading data", 0.2),
            ("Feature engineering", 0.4),
            ("Training model", 0.6),
            ("Evaluating", 0.8),
            ("Saving model", 0.95),
        ]
        
        for stage_name, progress in stages:
            job["progress"] = progress
            # Simulate work
            import asyncio
            await asyncio.sleep(1)
        
        # Mark complete
        job["status"] = "completed"
        job["progress"] = 1.0
        job["completedAt"] = datetime.utcnow()
        job["metrics"] = {
            "accuracy": 0.0,
            "note": "Model marked INSUFFICIENT_DATA - no real training performed",
        }
        
    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        job["completedAt"] = datetime.utcnow()