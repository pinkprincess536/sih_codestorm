# import cv2
# import numpy as np
# import matplotlib.pyplot as plt
# from skimage.metrics import structural_similarity as ssim
# import easyocr
# import os
# import csv
# import re
# import hashlib # <-- ADDED: Import the hashing library

# # ====================================================================
# # CONFIGURATION AND INITIALIZATION
# # ====================================================================
# try:
#     READER = easyocr.Reader(['en'], gpu=False) 
# except Exception as e:
#     print(f"Error initializing EasyOCR Reader: {e}")
#     READER = None

# def generate_ssim_heatmap(reference_path, test_path):
#     """
#     Generates a structural similarity (SSIM) heatmap to visually highlight
#     tampered or structurally inconsistent areas in a document.
#     """
#     print("--- Running SSIM Heatmap Generation ---")
#     try:
#         reference = cv2.imread(reference_path)
#         test = cv2.imread(test_path)

#         if reference is None:
#             print(f"Error: Reference image not found at {reference_path}")
#             return
#         if test is None:
#             print(f"Error: Test image not found at {test_path}")
#             return

#         if reference.shape != test.shape:
#             print("Warning: Images have different dimensions. Resizing test image.")
#             test = cv2.resize(test, (reference.shape[1], reference.shape[0]))

#         gray_reference = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
#         gray_test = cv2.cvtColor(test, cv2.COLOR_BGR2GRAY)

#         (score, ssim_map) = ssim(gray_reference, gray_test, full=True)
#         print(f"Global SSIM Score: {score:.4f}")

#         ssim_map = (ssim_map - np.min(ssim_map)) / (np.max(ssim_map) - np.min(ssim_map))
#         ssim_map_inverted = 1 - ssim_map
#         ssim_map_blurred = cv2.GaussianBlur(ssim_map_inverted, (51, 51), 0)

#         heatmap = plt.cm.jet(ssim_map_blurred)[:,:,:3]
#         heatmap = (heatmap * 255).astype(np.uint8)

#         heatmap_on_image = cv2.addWeighted(test, 0.7, heatmap, 0.3, 0)
        
#         fig, ax = plt.subplots(figsize=(10, 8))
#         ax.imshow(cv2.cvtColor(heatmap_on_image, cv2.COLOR_BGR2RGB)) 
#         ax.set_title('SSIM Forgery Detection Heatmap')
#         ax.axis('off')

#         plt.tight_layout()
#         plt.show()

#     except Exception as e:
#         print(f"An error occurred during SSIM heatmap generation: {e}")

# def extract_fields(image_path):
#     """
#     Performs OCR and attempts to extract specific fields.
#     """
#     print("--- Running EasyOCR Field Extraction ---")
#     extracted_data = {
#         'University Name': 'N/A',
#         'Certificate Holder Name': 'N/A',
#         'Course': 'N/A',
#         'Grade': 'N/A',
#         'Roll No': 'N/A',
#         'Certificate ID': 'N/A'
#     }

#     if not READER or not os.path.exists(image_path):
#         if not READER:
#              print("OCR Reader is not initialized. Cannot proceed.")
#         return extracted_data
    
#     try:
#         results = READER.readtext(image_path)
#         all_text = " ".join([text.strip() for (bbox, text, conf) in results if text.strip()])
#         text_lines = [text.strip() for (bbox, text, conf) in results if text.strip()]
        
#         uni_end_idx = 0
#         uni_start_idx = -1
#         for i, line in enumerate(text_lines):
#             if 'Institute' in line or 'University' in line or 'Technology' in line:
#                 uni_start_idx = i
#                 break

#         if uni_start_idx != -1:
#             uni_name_parts = [text_lines[uni_start_idx]]
#             uni_end_idx = uni_start_idx + 1
#             for i in range(uni_end_idx, min(uni_start_idx + 3, len(text_lines))):
#                 next_line = text_lines[i].strip()
#                 if len(next_line.split()) <= 4 and ('of' in next_line.lower() or 'technology' in next_line.lower()):
#                     uni_name_parts.append(next_line)
#                     uni_end_idx = i + 1
#                 else:
#                     break
#             extracted_data['University Name'] = " ".join(uni_name_parts).strip()
            
#         name_search_start = uni_end_idx 
#         for i in range(name_search_start, len(text_lines)):
#             line = text_lines[i]
#             if len(line.split()) >= 2 and 'course' not in line.lower() and 'roll' not in line.lower() and 'id' not in line.lower() and 'successfully' not in line.lower():
#                 extracted_data['Certificate Holder Name'] = line
#                 break
        
#         roll_match = re.search(r'(?:Roll\s*Number|Roll\s*No)\s*[:\s]*(\S+)', all_text, re.IGNORECASE)
#         if roll_match:
#             extracted_data['Roll No'] = roll_match.group(1).strip()
            
#         id_match = re.search(r'(?:Certificate\s*ID|Cert\s*ID|ID\s*)\s*[:\s]*(\S+)', all_text, re.IGNORECASE)
#         if id_match:
#             extracted_data['Certificate ID'] = id_match.group(1).strip()
            
#         grade_match = re.search(r'(?:Grade\s*[-\s:]*|with\s*Grade\s*[-\s:]*)\s*(\S)', all_text, re.IGNORECASE)
#         if grade_match:
#             extracted_data['Grade'] = grade_match.group(1).strip()

#         course_match = re.search(r'completed the course of\s*(.*?)\s*(authorized by|with Grade)', all_text, re.IGNORECASE | re.DOTALL)
#         if course_match:
#             course_name = course_match.group(1).strip()
#             course_name = re.sub(r'(?:an\s+online\s+non-credit\s+course|a\s+non-credit\s+course)', '', course_name, flags=re.IGNORECASE).strip()
#             extracted_data['Course'] = course_name
        
#         if extracted_data['Course'] == 'N/A':
#              course_match_fallback = re.search(r'course of\s*([A-Z09\s]+)', all_text, re.IGNORECASE)
#              if course_match_fallback:
#                  extracted_data['Course'] = course_match_fallback.group(1).strip()

#         return extracted_data

#     except Exception as e:
#         print(f"An unexpected error occurred during structured extraction: {e}")
#         return extracted_data

# def save_to_csv(data_list, output_filename='extracted_certificates.csv'):
#     """
#     Saves a list of dictionaries (extracted data) into a CSV file.
#     """
#     if not data_list:
#         print("No data to save.")
#         return

#     fieldnames = list(data_list[0].keys())
#     file_exists = os.path.exists(output_filename)

#     try:
#         with open(output_filename, 'a', newline='', encoding='utf-8') as csvfile:
#             writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
#             if not file_exists:
#                 writer.writeheader()
#             writer.writerows(data_list)
#         print(f"\nSuccessfully saved {len(data_list)} certificate record(s) to '{output_filename}'")
#     except Exception as e:
#         print(f"Error saving data to CSV: {e}")

# # --- Combined Main Execution ---
# if __name__ == "__main__":
    
#     REFERENCE_IMAGE_PATH = 'genuine.png'
#     TEST_IMAGE_PATH = 'test5.png' 
    
#     generate_ssim_heatmap(REFERENCE_IMAGE_PATH, TEST_IMAGE_PATH) 

#     CERTIFICATE_FILE_PATH = TEST_IMAGE_PATH
#     OUTPUT_CSV_FILE = 'extracted_certificates.csv'
    
#     if not os.path.exists(CERTIFICATE_FILE_PATH):
#         print(f"\nFATAL: Image file not found at path: {CERTIFICATE_FILE_PATH}.")
#     elif READER is None:
#         print("\nFATAL: EasyOCR initialization failed. Check console for error messages.")
#     else:
#         # Run extraction
#         extracted_fields = extract_fields(CERTIFICATE_FILE_PATH)
        
#         print("\n" + "="*60)
#         print(f"           Extraction Results for {CERTIFICATE_FILE_PATH}           ")
#         print("="*60)
#         for key, value in extracted_fields.items():
#             print(f"{key:<25}: {value}")
#         print("="*60)

#         # --- START: HASH GENERATION (NEW CODE) ---
#         # To ensure a consistent hash, we create a single string by
#         # joining the extracted field values in a specific, fixed order.
        
#         fields_to_hash = [
#             extracted_fields.get('University Name', 'N/A'),
#             extracted_fields.get('Certificate Holder Name', 'N/A'),
#             extracted_fields.get('Course', 'N/A'),
#             extracted_fields.get('Grade', 'N/A'),
#             extracted_fields.get('Roll No', 'N/A'),
#             extracted_fields.get('Certificate ID', 'N/A')
#         ]
        
#         # Concatenate all field values into a single string
#         concatenated_string = "".join(str(field) for field in fields_to_hash)
        
#         # Create a SHA-256 hash object
#         sha256_hash = hashlib.sha256()
        
#         # Update the hash object with the bytes of the concatenated string
#         sha256_hash.update(concatenated_string.encode('utf-8'))
        
#         # Get the hexadecimal representation of the hash
#         final_hash = sha256_hash.hexdigest()
        
#         print("\n--- Certificate Hash ---")
#         print(f"Generated SHA-256 Hash: {final_hash}")
#         print("="*60)
#         # --- END: HASH GENERATION ---

#         # Save to CSV
#         save_to_csv([extracted_fields], OUTPUT_CSV_FILE)




#new


import cv2
import numpy as np
import matplotlib.pyplot as plt
from skimage.metrics import structural_similarity as ssim
import easyocr
import os
import csv
import re
import hashlib
import json # <-- ADDED: Import the JSON library

# ====================================================================
# CONFIGURATION AND INITIALIZATION
# ====================================================================
try:
    READER = easyocr.Reader(['en'], gpu=False) 
except Exception as e:
    print(f"Error initializing EasyOCR Reader: {e}")
    READER = None

def generate_ssim_heatmap(reference_path, test_path):
    """
    Generates a structural similarity (SSIM) heatmap to visually highlight
    tampered or structurally inconsistent areas in a document.
    """
    print("--- Running SSIM Heatmap Generation ---")
    try:
        reference = cv2.imread(reference_path)
        test = cv2.imread(test_path)

        if reference is None:
            print(f"Error: Reference image not found at {reference_path}")
            return
        if test is None:
            print(f"Error: Test image not found at {test_path}")
            return

        if reference.shape != test.shape:
            print("Warning: Images have different dimensions. Resizing test image.")
            test = cv2.resize(test, (reference.shape[1], reference.shape[0]))

        gray_reference = cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY)
        gray_test = cv2.cvtColor(test, cv2.COLOR_BGR2GRAY)

        (score, ssim_map) = ssim(gray_reference, gray_test, full=True)
        print(f"Global SSIM Score: {score:.4f}")

        ssim_map = (ssim_map - np.min(ssim_map)) / (np.max(ssim_map) - np.min(ssim_map))
        ssim_map_inverted = 1 - ssim_map
        ssim_map_blurred = cv2.GaussianBlur(ssim_map_inverted, (51, 51), 0)

        heatmap = plt.cm.jet(ssim_map_blurred)[:,:,:3]
        heatmap = (heatmap * 255).astype(np.uint8)

        heatmap_on_image = cv2.addWeighted(test, 0.7, heatmap, 0.3, 0)
        
        fig, ax = plt.subplots(figsize=(10, 8))
        ax.imshow(cv2.cvtColor(heatmap_on_image, cv2.COLOR_BGR2RGB)) 
        ax.set_title('SSIM Forgery Detection Heatmap')
        ax.axis('off')

        plt.tight_layout()
        plt.show()

    except Exception as e:
        print(f"An error occurred during SSIM heatmap generation: {e}")

def extract_fields(image_path):
    """
    Performs OCR and attempts to extract specific fields.
    """
    print("--- Running EasyOCR Field Extraction ---")
    extracted_data = {
        'University Name': 'N/A',
        'Certificate Holder Name': 'N/A',
        'Course': 'N/A',
        'Grade': 'N/A',
        'Roll No': 'N/A',
        'Certificate ID': 'N/A'
    }

    if not READER or not os.path.exists(image_path):
        if not READER:
             print("OCR Reader is not initialized. Cannot proceed.")
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
        print(f"An unexpected error occurred during structured extraction: {e}")
        return extracted_data

def save_to_csv(data_list, output_filename='extracted_certificates.csv'):
    """
    Saves a list of dictionaries (extracted data) into a CSV file.
    """
    if not data_list:
        print("No data to save.")
        return

    fieldnames = list(data_list[0].keys())
    file_exists = os.path.exists(output_filename)

    try:
        with open(output_filename, 'a', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            if not file_exists:
                writer.writeheader()
            writer.writerows(data_list)
        print(f"\nSuccessfully saved {len(data_list)} certificate record(s) to '{output_filename}'")
    except Exception as e:
        print(f"Error saving data to CSV: {e}")

# --- Combined Main Execution ---
if __name__ == "__main__":
    
    REFERENCE_IMAGE_PATH = 'genuine.png'
    TEST_IMAGE_PATH = 'test5.png' 
    
    generate_ssim_heatmap(REFERENCE_IMAGE_PATH, TEST_IMAGE_PATH) 

    CERTIFICATE_FILE_PATH = TEST_IMAGE_PATH
    OUTPUT_CSV_FILE = 'extracted_certificates.csv'
    
    if not os.path.exists(CERTIFICATE_FILE_PATH):
        print(f"\nFATAL: Image file not found at path: {CERTIFICATE_FILE_PATH}.")
    elif READER is None:
        print("\nFATAL: EasyOCR initialization failed. Check console for error messages.")
    else:
        # Run extraction
        extracted_fields = extract_fields(CERTIFICATE_FILE_PATH)
        
        print("\n" + "="*60)
        print(f"           Extraction Results for {CERTIFICATE_FILE_PATH}           ")
        print("="*60)
        for key, value in extracted_fields.items():
            print(f"{key:<25}: {value}")
        print("="*60)

        # --- START: HASH GENERATION (REVISED LOGIC TO MATCH JAVASCRIPT) ---
        
        # Create a stable JSON string by sorting the dictionary keys. This ensures
        # that the input to the hash function is always identical for the same data.
        # sort_keys=True is equivalent to JavaScript's Object.keys().sort() approach.
        # separators=(',', ':') creates a compact string without whitespace, matching JSON.stringify.
        stable_json_string = json.dumps(extracted_fields, sort_keys=True, separators=(',', ':'))
        
        # Create a SHA-256 hash object
        sha256_hash = hashlib.sha256()
        
        # Update the hash object with the bytes of the stable JSON string
        sha256_hash.update(stable_json_string.encode('utf-8'))
        
        # Get the hexadecimal representation of the hash
        final_hash = sha256_hash.hexdigest()
        
        print("\n--- Certificate Hash ---")
        print(f"Generated SHA-256 Hash: {final_hash}")
        print("="*60)
        # --- END: HASH GENERATION ---

        # Save to CSV
        save_to_csv([extracted_fields], OUTPUT_CSV_FILE)