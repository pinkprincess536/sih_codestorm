import os
import io
import json
import hashlib
import psycopg2
from dotenv import load_dotenv
import google.generativeai as genai
from PIL import Image

# --- Configuration & Initialization ---
load_dotenv()

DB_URL = os.getenv("DATABASE_URL")
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# --- Hashing Function ---
def generate_certificate_hash(data: dict) -> str:
    """
    Generates a SHA-256 hash for a certificate record.
    Skips null or empty fields to handle multiple certificate types.
    """
    fields_to_hash = [
        data.get("Name"),
        data.get("Course"),
        data.get("Grade"),
        data.get("Roll"),
        data.get("Certificate_ID"),
    ]

    # Skip null/empty
    filtered_fields = [
        str(field).lower().strip()
        for field in fields_to_hash
        if field not in [None, ""]
    ]

    concatenated_string = "|".join(filtered_fields)
    print(f"[Python HASH INPUT]: {concatenated_string}")

    return hashlib.sha256(concatenated_string.encode()).hexdigest()

# --- Database Verification ---
def _check_hash_in_db(certificate_hash: str) -> bool:
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        print(f" Querying database for hash: {certificate_hash}")

        query = """
            SELECT EXISTS (
                SELECT 1 FROM student_details WHERE "Original_Hash" = %s
            );
        """
        cur.execute(query, (certificate_hash,))
        hash_exists = cur.fetchone()[0]

        cur.close()
        return hash_exists

    except Exception as e:
        print(f" Database connection or query failed: {e}")
        return False
    finally:
        if conn is not None:
            conn.close()

# --- LLM Extraction ---
async def _call_llm_for_extraction(image_bytes: bytes) -> dict:
    img = Image.open(io.BytesIO(image_bytes))

    prompt = """
    Analyze the attached certificate image and extract the following details into a JSON object.
    If a field is not present, set its value to null.

    - "recipient_name"
    - "Course"
    - "Grade"
    - "roll_no"
    - "Certificate_ID"
    """

    model = genai.GenerativeModel("gemini-1.5-flash-latest")
    response = await model.generate_content_async([prompt, img], stream=False)

    raw_text = response.text
    json_start = raw_text.find("{")
    json_end = raw_text.rfind("}") + 1

    if json_start == -1 or json_end == 0:
        raise ValueError("No valid JSON object found in the AI response.")

    json_string = raw_text[json_start:json_end]
    return json.loads(json_string)

# --- Orchestrator ---
async def process_and_verify_certificate(image_bytes: bytes) -> dict:
    try:
        extracted_data = await _call_llm_for_extraction(image_bytes)
        print(" LLM Extraction Success! Extracted data:", extracted_data)

        mapped_data = {
            "Name": extracted_data.get("recipient_name"),
            "Course": extracted_data.get("Course"),
            "Grade": extracted_data.get("Grade"),
            "Roll": extracted_data.get("roll_no"),
            "Certificate_ID": extracted_data.get("Certificate_ID"),
        }

        certificate_hash = generate_certificate_hash(mapped_data)
        is_authentic = _check_hash_in_db(certificate_hash)

        verification_status = " Certificate is Authentic" if is_authentic else " Not Found / Tampered"
        print(" VERIFIED" if is_authentic else " UNVERIFIED")

        return {
            "extracted_data": mapped_data,
            "verification_status": verification_status,
            "certificate_hash": certificate_hash,
        }

    except Exception as e:
        print(f" An error occurred during the verification process: {e}")
        return {
            "extracted_data": None,
            "verification_status": f"Error during processing: {e}",
            "certificate_hash": None,
        }
