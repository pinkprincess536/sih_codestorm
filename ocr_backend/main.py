# main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles # Needed to serve heatmaps statically
from ocr_routes import router as ocr_router
import uvicorn
import os

# --- Configuration (Keeping original config paths for consistency) ---
HEATMAP_FOLDER = 'heatmaps'
os.makedirs(HEATMAP_FOLDER, exist_ok=True)
# -------------------------------------------------------------------

app = FastAPI(title="PramaanVault OCR & Blockchain Verification API")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Register the OCR router
app.include_router(ocr_router)

# 2. Mount the static directory to serve heatmap images
# The path must match what is used in ocr_routes.py (e.g., /ocr/heatmap/filename)
app.mount(f"/{ocr_router.prefix}/heatmap", StaticFiles(directory=HEATMAP_FOLDER), name="heatmaps")


@app.get("/health")
async def health_check():
    # A simple health check is all that's needed here
    return {"status": "healthy"}

# --- Server Execution ---
if __name__ == "__main__":
    # Remove all the previous test logic and start the FastAPI server
    print("--- Starting FastAPI Server on http://127.0.0.1:8000 ---")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)