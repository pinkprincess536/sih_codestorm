from fastapi import FastAPI, File, UploadFile, HTTPException
from model import extract_details, validate

app = FastAPI()


@app.post("/verify")
async def verify(file: UploadFile = File(...)):
    try:
        content = await file.read()
        details = extract_details(content)
        result = validate(details)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# from fastapi import FastAPI, File, UploadFile
# from model import extract_details, validate

# app = FastAPI()

# @app.post("/verify")
# async def verify(file: UploadFile = File(...)):
#     content = await file.read()
#     details = extract_details(content)
#     result = validate(details)
#     return result


#to run your fastAPI server use 
#python -m uvicorn main:app --reload --port 8000