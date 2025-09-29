from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Use non-GUI backend
import matplotlib.pyplot as plt
from skimage.metrics import structural_similarity as ssim
import easyocr
import os
import csv
import re
import shutil
import hashlib
import json
import subprocess
from datetime import datetime
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    READER = easyocr.Reader(['en'], gpu=False)
except Exception as e:
    print(f"Error initializing EasyOCR: {e}")
    READER = None

REFERENCE_IMAGE_PATH = 'genuine.png'
UPLOAD_FOLDER = 'uploads'
HEATMAP_FOLDER = 'heatmaps'
CSV_PATH = 'data/certificates2.csv'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(HEATMAP_FOLDER, exist_ok=True)
os.makedirs('data', exist_ok=True)

def generate_ssim_heatmap(reference_path, test_path, output_path):
    try:
        reference = cv2.imread(reference_path)
        test = cv2.imread(test_path)

        if reference is None or test is None:
            return None

        if reference.shape != test.shape:
            test = cv2.resize(test, (reference.shape[1], reference.shape[0]))

        gray_reference = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
        gray_test = cv2.cvtColor(test, cv2.COLOR_BGR2GRAY)

        (score, ssim_map) = ssim(gray_reference, gray_test, full=True)

        ssim_map = (ssim_map - np.min(ssim_map)) / (np.max(ssim_map) - np.min(ssim_map))
        ssim_map_inverted = 1 - ssim_map
        ssim_map_blurred = cv2.GaussianBlur(ssim_map_inverted, (51, 51), 0)

        heatmap = plt.cm.jet(ssim_map_blurred)[:,:,:3]
        heatmap = (heatmap * 255).astype(np.uint8)
        heatmap_on_image = cv2.addWeighted(test, 0.7, heatmap, 0.3, 0)
        
        cv2.imwrite(output_path, cv2.cvtColor(heatmap_on_image, cv2.COLOR_RGB2BGR))
        
        return score

    except Exception as e:
        print(f"Error generating heatmap: {e}")
        return None

def extract_fields(image_path):
    extracted_data = {
        'University Name': 'N/A',
        'Certificate Holder Name': 'N/A',
        'Course': 'N/A',
        'Grade': 'N/A',
        'Roll No': 'N/A',
        'Certificate ID': 'N/A'
    }

    if not READER or not os.path.exists(image_path):
        return extracted_data
    
    try:
        results = READER.readtext(image_path)
        all_text = " ".join([text.strip() for (bbox, text, conf) in results if text.strip()])
        text_lines = [text.strip() for (bbox, text, conf) in results if text.strip()]
        
        uni_end_idx = 0

        uni_start_idx = -1
        for i, line in enumerate(text_lines):
            if 'Institute' in line or 'University' in line or 'Technology' in line:
                uni_start_idx = i
                break

        if uni_start_idx != -1:
            uni_name_parts = [text_lines[uni_start_idx]]
            uni_end_idx = uni_start_idx + 1
            
            for i in range(uni_end_idx, min(uni_start_idx + 3, len(text_lines))):
                next_line = text_lines[i].strip()
                if len(next_line.split()) <= 4 and ('of' in next_line.lower() or 'technology' in next_line.lower()):
                    uni_name_parts.append(next_line)
                    uni_end_idx = i + 1
                else:
                    break
            
            extracted_data['University Name'] = " ".join(uni_name_parts).strip()
        
        name_search_start = uni_end_idx 
        for i in range(name_search_start, len(text_lines)):
            line = text_lines[i]
            if len(line.split()) >= 2 and 'course' not in line.lower() and 'roll' not in line.lower() and 'id' not in line.lower() and 'successfully' not in line.lower():
                extracted_data['Certificate Holder Name'] = line
                break

        roll_match = re.search(r'(?:Roll\s*Number|Roll\s*No)\s*[:\s]*(\S+)', all_text, re.IGNORECASE)
        if roll_match:
            extracted_data['Roll No'] = roll_match.group(1).strip()
            
        id_match = re.search(r'(?:Certificate\s*ID|Cert\s*ID|ID\s*)\s*[:\s]*(\S+)', all_text, re.IGNORECASE)
        if id_match:
            extracted_data['Certificate ID'] = id_match.group(1).strip()
            
        grade_match = re.search(r'(?:Grade\s*[-\s:]*|with\s*Grade\s*[-\s:]*)\s*(\S)', all_text, re.IGNORECASE)
        if grade_match:
            extracted_data['Grade'] = grade_match.group(1).strip()

        course_match = re.search(r'completed the course of\s*(.*?)\s*(authorized by|with Grade)', all_text, re.IGNORECASE | re.DOTALL)
        if course_match:
            course_name = course_match.group(1).strip()
            course_name = re.sub(r'(?:an\s+online\s+non-credit\s+course|a\s+non-credit\s+course)', '', course_name, flags=re.IGNORECASE).strip()
            extracted_data['Course'] = course_name
        
        if extracted_data['Course'] == 'N/A':
             course_match_fallback = re.search(r'course of\s*([A-Z0-9\s]+)', all_text, re.IGNORECASE)
             if course_match_fallback:
                 extracted_data['Course'] = course_match_fallback.group(1).strip()

        return extracted_data

    except Exception as e:
        print(f"Error during OCR extraction: {e}")
        return extracted_data

def update_certificates_csv(extracted_data):
    """Update certificates2.csv with extracted data - CRITICAL FIX"""
    try:
        fieldnames = ['University Name', 'Certificate Holder Name', 'Course', 'Grade', 'Roll No', 'Certificate ID']
        file_exists = os.path.exists(CSV_PATH)
        
        row_data = {field: extracted_data.get(field, 'N/A') for field in fieldnames}
        
        with open(CSV_PATH, 'a' if file_exists else 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            if not file_exists:
                writer.writeheader()
            writer.writerow(row_data)
        
        print(f"✅ Successfully updated {CSV_PATH}")
        return True
    except Exception as e:
        print(f"❌ Error updating CSV: {e}")
        return False

def generate_hash(data):
    sorted_data = json.dumps(data, sort_keys=True)
    return hashlib.sha256(sorted_data.encode()).hexdigest()

def run_blockchain_verification():
    try:
        result = subprocess.run(
            ['truffle', 'exec', 'batchVerify.js', f'--file={CSV_PATH}'],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            results_file = CSV_PATH.replace('.csv', '_verification_results.json')
            if os.path.exists(results_file):
                with open(results_file, 'r') as f:
                    return json.load(f)
        
        return None
    except Exception as e:
        print(f"Error running blockchain verification: {e}")
        return None

@app.post("/ocr/verify")
async def verify_certificate(file: UploadFile = File(...)):
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        upload_path = os.path.join(UPLOAD_FOLDER, f"{timestamp}_{file.filename}")
        
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 1. Extract fields
        extracted_data = extract_fields(upload_path)
        print(f"Extracted data: {extracted_data}")
        
        # 2. Update certificates2.csv - THIS IS THE KEY FIX
        csv_updated = update_certificates_csv(extracted_data)
        if not csv_updated:
            print("Warning: CSV update failed, continuing with verification")
        
        # 3. Generate heatmap
        heatmap_filename = f"heatmap_{timestamp}.png"
        heatmap_path = os.path.join(HEATMAP_FOLDER, heatmap_filename)
        ssim_score = generate_ssim_heatmap(REFERENCE_IMAGE_PATH, upload_path, heatmap_path)
        
        # 4. Run blockchain verification
        verification_results = run_blockchain_verification()
        
        # 5. Get verification result
        generated_hash = generate_hash(extracted_data)
        is_valid = False
        validation_reason = "Certificate not found in blockchain"
        blockchain_status = "INVALID"
        
        if verification_results:
            last_result = verification_results[-1] if verification_results else None
            
            if last_result:
                is_valid = last_result.get('isValid', False)
                blockchain_status = last_result.get('status', 'INVALID')
                
                if is_valid:
                    validation_reason = "Certificate hash matches blockchain record. This certificate is authentic and has been verified against the university's blockchain ledger."
                else:
                    validation_reason = "Certificate hash does NOT match any blockchain record. This certificate may be forged, altered, or not issued by the claimed institution."
        
        return JSONResponse({
            "status": "success",
            "extracted_data": extracted_data,
            "heatmap_url": f"/heatmap/{heatmap_filename}",
            "ssim_score": float(ssim_score) if ssim_score else 0.0,
            "blockchain_hash": generated_hash,
            "is_valid": is_valid,
            "validation_reason": validation_reason,
            "verification_status": blockchain_status,
            "csv_updated": csv_updated
        })
        
    except Exception as e:
        print(f"Error in verify_certificate: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/heatmap/{filename}")
async def get_heatmap(filename: str):
    file_path = os.path.join(HEATMAP_FOLDER, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Heatmap not found")
    return FileResponse(file_path)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "ocr_ready": READER is not None}

# --- Combined Main Execution (Corrected Order) ---
if __name__ == "__main__":
    
    # Configuration
    REFERENCE_IMAGE_PATH = 'genuine.png'
    TEST_IMAGE_PATH = 'test1.png'
    OUTPUT_CSV_FILE = 'extracted_certificates.csv'
    
    # 1. RUN OCR FIELD EXTRACTION AND CSV SAVING FIRST
    if not os.path.exists(TEST_IMAGE_PATH):
        print(f"\nFATAL: Image file not found at path: {TEST_IMAGE_PATH}.")
        print("Please check the filename and ensure the image is in the same directory.")
    elif READER is None:
        print("\nFATAL: EasyOCR initialization failed. Check console for error messages.")
    else:
        # Run extraction
        extracted_fields = extract_fields(TEST_IMAGE_PATH)
        
        # This will now print to the terminal immediately
        print("\n" + "="*60)
        print(f"       Extraction Results for {TEST_IMAGE_PATH}        ")
        print("="*60)
        for key, value in extracted_fields.items():
            print(f"{key:<25}: {value}")
        print("="*60)

        # Save to CSV
        save_to_csv([extracted_fields], OUTPUT_CSV_FILE)

    # 2. RUN SSIM HEATMAP GENERATION LAST
    # The script will pause here until you close the heatmap window
    print("\n--- Now generating the SSIM Heatmap... ---")
    generate_ssim_heatmap(REFERENCE_IMAGE_PATH, TEST_IMAGE_PATH)
    
    print("\n--- Script finished. ---")