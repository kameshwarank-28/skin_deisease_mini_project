import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.app.api.endpoints import router as api_router
from backend.app.api.health_routes import router as health_router
from backend.app.services.database import init_db
from backend.app.services.scheduler import process_appointment_reminders

frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    init_db()
    print("[FastAPI] Database schemas verified on startup.")
    
    # Start background appointment reminder task
    reminder_task = asyncio.create_task(process_appointment_reminders())
    print("[FastAPI] Background appointment reminder worker activated.")
    
    yield
    
    # Shutdown sequence
    reminder_task.cancel()
    try:
        await reminder_task
    except asyncio.CancelledError:
        pass
    print("[FastAPI] Application shutdown complete.")

app = FastAPI(
    title="DermAI — Skin Disease Decision Support & Health Monitoring API",
    description="Deep Learning dermatological classification API with XAI Attention Maps, Skin Health Tracking, Symptom Monitoring, and Follow-up Management.",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(api_router, prefix="/api")
app.include_router(health_router, prefix="/api")

if frontend_dist.exists() and (frontend_dist / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str = ""):
        if full_path.startswith("api") or full_path in ["docs", "redoc", "openapi.json"]:
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = frontend_dist / full_path
        if target_file.is_file():
            return FileResponse(target_file)
        if full_path == "" and "text/html" not in request.headers.get("accept", ""):
            return {
                "message": "DermAI Decision Support & Monitoring API is active and healthy.",
                "documentation": "/docs",
                "health_check": "/api/health"
            }
        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/", summary="Root Endpoint")
    def root():
        return {
            "message": "DermAI Decision Support & Monitoring API is active and healthy.",
            "documentation": "/docs",
            "health_check": "/api/health"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
