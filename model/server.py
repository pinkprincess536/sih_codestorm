from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

# Import the main processing function from your model logic file
from ocr_model import process_and_verify_certificate

# --- FastAPI Server Setup ---
app = FastAPI(title="Certificate Verification API")

# --- API Endpoint ---
@app.post("/extract-details/")
async def extract_and_verify_certificate_endpoint(file: UploadFile = File(...)):
    """
    Endpoint to receive a certificate image, process it, and return the verification result.
    """
    allowed_content_types = ["image/jpeg", "image/png"]
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Please upload a JPEG or PNG. You provided: {file.content_type}"
        )

    contents = await file.read()

    try:
        result = await process_and_verify_certificate(contents)
        return JSONResponse(content=result)

    except Exception as e:
        print(f"An error occurred during processing: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to process certificate with AI model: {str(e)}"}
        )
