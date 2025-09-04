import re
import pandas as pd
from io import BytesIO
from PIL import Image
import pytesseract

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def extract_details(image_bytes: bytes) -> dict:
    img = Image.open(BytesIO(image_bytes))
    text = pytesseract.image_to_string(img)
    print("OCR Output:\n", text)   # Debug print

    patterns = {
        "name": r"name\s*[:\-]?\s*([A-Za-z ]+)",
        "roll no": r"roll\s*no\s*[:\-]?\s*(\d+)",
        "course": r"course\s*[:\-]?\s*([A-Za-z]+)",
        "grade": r"grade\s*[:\-]?\s*([A-Za-z0-9\+\-]+)",
        "certificate id": r"certificate\s*id\s*[:\-]?\s*(\d+)"
    }

    details = {}
    for key, pattern in patterns.items():
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            details[key] = m.group(1).strip()
    return details


def validate(details: dict, dataset="dataset.csv") -> dict:
    df = pd.read_csv(dataset, dtype=str)
    df.columns = df.columns.str.strip().str.lower()

    match = (
        (df['name'].str.strip().str.lower() == details.get("name", "").lower()) &
        (df['roll no'].str.strip() == details.get("roll no", "")) &
        (df['course'].str.strip().str.lower() == details.get("course", "").lower()) &
        (df['grade'].str.strip().str.upper() == details.get("grade", "").upper()) &
        (df['certificate id'].str.strip() == details.get("certificate id", ""))
    )

    return {"is_valid": bool(match.any()), "details": details}
