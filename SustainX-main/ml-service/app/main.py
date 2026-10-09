"""
SustainX ML Service - FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.api import health, predictions, models, training


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.SERVICE_NAME} v{settings.SERVICE_VERSION}")
    yield
    # Shutdown
    print(f"Shutting down {settings.SERVICE_NAME}")


app = FastAPI(
    title="SustainX ML Service",
    description="Machine Learning service for SustainX Smart City Waste Management",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "Internal server error",
        },
    )


# Include routers
app.include_router(health.router, prefix=settings.API_PREFIX, tags=["health"])
app.include_router(predictions.router, prefix=settings.API_PREFIX, tags=["predictions"])
app.include_router(models.router, prefix=settings.API_PREFIX, tags=["models"])
app.include_router(training.router, prefix=settings.API_PREFIX, tags=["training"])


@app.get("/")
async def root():
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "status": "running",
        "docs": "/docs",
    }