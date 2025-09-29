# ocr_routes.py

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from ocr_service import process_certificate, HEATMAP_FOLDER
import uuid, os

router = APIRouter(prefix="/ocr", tags=["OCR"])

# Create a common folder for temporary uploads
UPLOAD_TEMP_FOLDER = "uploads"
os.makedirs(UPLOAD_TEMP_FOLDER, exist_ok=True)


@router.post("/verify")
async def verify_certificate(file: UploadFile = File(...)):
    # Unique filename for saving the upload
    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_TEMP_FOLDER, filename)

    # Save uploaded file temporarily (CRITICAL: Must be saved before OCR/CV2 can read it)
    try:
        with open(file_path, "wb") as f:
            # Use file.read() for async reading and f.write() for sync writing
            f.write(await file.read()) 
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {e}")

    # Run OCR + Hash + Blockchain + Heatmap via the service function
    try:
        result_data = process_certificate(file_path)
        return JSONResponse(result_data)
    except Exception as e:
        # Ensure the temp file is cleaned up even on internal error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Verification processing failed: {e}")


@router.get("/heatmap/{filename}")
async def get_heatmap(filename: str):
    file_path = os.path.join(HEATMAP_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Heatmap not found")
    # FileResponse handles setting the correct content-type for the image
    return FileResponse(file_path)