import pandas as pd
import pytesseract
from PIL import Image
import re

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


im = Image.open("fake.png")
result = pytesseract.image_to_string(im)


details = {}
patterns = {
    "name": r"Name\s*:\s*([A-Za-z ]+)",
    "roll no": r"Roll\s*No\s*:\s*(\d+)",
    "course": r"Course\s*:\s*([A-Za-z]+)",
    "grade": r"Grade\s*:\s*([A-Za-z0-9\+\-]+)", 
    "certificate id": r"Certificate\s*ID\s*:\s*(\d+)"
}

for key, pattern in patterns.items():
    m = re.search(pattern, result, re.IGNORECASE)
    if m:
        details[key] = m.group(1).strip()





a = pd.read_csv("dataset.csv")
a.columns = a.columns.str.strip().str.lower()



match = (
    (a['name'].astype(str).str.strip().str.lower() == details.get("name", "").strip().lower()) &
    (a['roll no'].astype(str).str.strip() == details.get("roll no", "").strip()) &
    (a['course'].astype(str).str.strip().str.lower() == details.get("course", "").strip().lower()) &
    (a['grade'].astype(str).str.strip().str.upper() == details.get("grade", "").strip().upper()) &
    (a['certificate id'].astype(str).str.strip() == details.get("certificate id", "").strip())
)



row = a[a['certificate id'].astype(str).str.strip() == details.get("certificate id", "").strip()]
if not row.empty:
   

    print("Name match:", row['name'].iloc[0].strip().lower() == details.get("name", "").strip().lower())
    print("Roll match:", str(row['roll no'].iloc[0]).strip() == details.get("roll no", "").strip())
    print("Course match:", row['course'].iloc[0].strip().lower() == details.get("course", "").strip().lower())
    print("Grade match:", row['grade'].iloc[0].strip().upper() == details.get("grade", "").strip().upper())

print("\n")

if match.any():
    print(" Valid Certificate")
else:
    print("Invalid Certificate")
