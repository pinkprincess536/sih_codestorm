# ocr_service.py

import os
import uuid
import shutil
import cv2
import numpy as np
import matplotlib
matplotlib.use('Agg') # Use non-GUI backend
import matplotlib.pyplot as plt
from skimage.metrics import structural_similarity as ssim
import easyocr
import re
import hashlib
import json
import requests
from typing import Dict, Tuple, Any

# ====================================================================
# CONFIGURATION AND INITIALIZATION
# ====================================================================
# Node.js/Express Backend URL for Verification
BLOCKCHAIN_API_URL = 'http://localhost:3000/api/verify-certificate' 

# The path for the genuine certificate template.
REFERENCE_IMAGE_PATH = 'genuine.png'
CSV_PATH = 'data/certificates2.csv'
HEATMAP_FOLDER = 'heatmaps' # Match the existing structure in main.py for file creation

try:
    # Initialize the EasyOCR Reader
    READER = easyocr.Reader(['en'], gpu=False) 
except Exception as e:
    print(f"Error initializing EasyOCR Reader: {e}")
    READER = None

# Ensure folders exist (matching logic from main.py)
os.makedirs('data', exist_ok=True)
os.makedirs(HEATMAP_FOLDER, exist_ok=True)


# ====================================================================
# HASHING HELPER FUNCTION (CRITICAL: Matches server.js logic)
# ====================================================================

def generate_stable_hash(extracted_data: Dict[str, Any]) -> Tuple[str, str]:
    """
    Generates a SHA-256 hash from the extracted data using a stable JSON stringification
    method that mirrors the JavaScript implementation in server.js.
    
    Returns:
        Tuple[str, str]: (Generated hash, stable JSON string)
    """
    # 1. Create a stable JSON string by sorting the dictionary keys and removing whitespace.
    #    This mirrors JavaScript's Object.keys().sort() approach used by stableStringify in server.js.
    stable_json_string = json.dumps(extracted_data, sort_keys=True, separators=(',', ':'))
    
    # 2. Create a SHA-256 hash object
    sha256_hash = hashlib.sha256()
    
    # 3. Update the hash object with the bytes of the stable JSON string
    sha256_hash.update(stable_json_string.encode('utf-8'))
    
    # 4. Get the hexadecimal representation of the hash
    final_hash = sha256_hash.hexdigest()
    
    return final_hash, stable_json_string

# ====================================================================
# BLOCKCHAIN VERIFICATION HELPER FUNCTION
# ====================================================================

def verify_on_blockchain(extracted_data: Dict[str, Any], candidate_hash: str) -> Dict[str, Any]:
    """
    Calls the existing Node.js verification API with the extracted data and hash.
    """
    print(f"--- Verifying Hash {candidate_hash[:8]}... on Blockchain via Node.js API ---")
    
    # Map Python keys to the keys expected by the Node.js API endpoint /api/verify-certificate
    api_payload = {
        "university": extracted_data.get('University Name', 'N/A'),
        "holderName": extracted_data.get('Certificate Holder Name', 'N/A'),
        "course": extracted_data.get('Course', 'N/A'),
        "grade": extracted_data.get('Grade', 'N/A'),
        "rollNo": extracted_data.get('Roll No', 'N/A'),
        "certificateId": extracted_data.get('Certificate ID', 'N/A')
    }
    
    try:
        response = requests.post(BLOCKCHAIN_API_URL, json=api_payload)
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"FATAL: Error connecting to Node.js verification API: {e}")
        return {
            "isValid": False,
            "timestamp": "0",
            "issuer": "N/A",
            "candidateHash": candidate_hash,
            "error": "Failed to connect to blockchain service (Node.js backend)"
        }

# ====================================================================
# OCR FIELD EXTRACTION (Copied from main.py)
# ====================================================================

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

# ====================================================================
# SSIM HEATMAP GENERATION (Copied from main.py)
# ====================================================================

def generate_ssim_heatmap(reference_path, test_path, output_path):
    # This is the function body copied directly from the original main.py
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
        
        # NOTE: Using cv2.imwrite for consistency with original main.py implementation
        cv2.imwrite(output_path, cv2.cvtColor(heatmap_on_image, cv2.COLOR_RGB2BGR))
        
        return score

    except Exception as e:
        print(f"Error generating heatmap: {e}")
        return None

# ====================================================================
# FASTAPI INTEGRATION FUNCTION (UPDATED)
# ====================================================================

def process_certificate(file_path: str) -> Dict[str, Any]:
    """
    Main function called by the FastAPI route to process the uploaded file,
    perform OCR, generate hash, verify on blockchain, and generate heatmap.
    """
    
    # --- 1. RUN OCR EXTRACTION ---
    extracted_data = extract_fields(file_path)
    print(f"Extracted data: {extracted_data}")
    
    # --- 2. GENERATE HASH (STABLE) ---
    generated_hash, stable_json = generate_stable_hash(extracted_data)
    print(f"Generated Stable Hash: {generated_hash}")
    
    # --- 3. RUN BLOCKCHAIN VERIFICATION ---
    verification_results = verify_on_blockchain(extracted_data, generated_hash)
    
    # --- 4. GENERATE HEATMAP ---
    os.makedirs(HEATMAP_FOLDER, exist_ok=True)
    heatmap_filename = f"{uuid.uuid4()}_heatmap.png"
    heatmap_path = os.path.join(HEATMAP_FOLDER, heatmap_filename)

    ssim_score = generate_ssim_heatmap(REFERENCE_IMAGE_PATH, file_path, heatmap_path)
    
    # --- 5. CLEANUP ---
    # Delete the original uploaded file
    if os.path.exists(file_path):
        os.remove(file_path)
        print(f"Cleaned up temporary file: {file_path}")

    # --- 6. FORMAT FINAL RESPONSE ---
    
    is_valid = verification_results.get('isValid', False)
    blockchain_status = "VALID" if is_valid else "INVALID"
    
    if is_valid:
        validation_reason = "Certificate hash matches blockchain record. This certificate is authentic and has been verified against the university's blockchain ledger."
    elif 'error' in verification_results:
        validation_reason = f"Verification service failed: {verification_results['error']}"
    else:
        validation_reason = "Certificate hash does NOT match any blockchain record. This certificate may be forged, altered, or not issued by the claimed institution."

    return {
        "status": "success",
        "extracted_data": extracted_data,
        "heatmap_url": f"/ocr/heatmap/{heatmap_filename}",
        "ssim_score": float(ssim_score) if ssim_score else 0.0,
        "blockchain_hash": generated_hash,
        "is_valid": is_valid,
        "validation_reason": validation_reason,
        "verification_status": blockchain_status,
        "issuer": verification_results.get('issuer', 'N/A'),
        "timestamp": verification_results.get('timestamp', '0')
    }