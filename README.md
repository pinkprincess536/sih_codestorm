# PramaanVault : Academic Integrity Engine



A blockchain-powered platform with AI-driven document analysis to combat academic certificate forgery.

---

 demo link
 (https://youtu.be/QSuoyqUMF24)




The Problem

Academic integrity is threatened by the increasing prevalence of forged and tampered degree certificates. Traditional verification methods are manual, time-consuming, and prone to errors, creating a trust deficit for employers, institutions, and government bodies. This project addresses the need for a secure, scalable, and instant verification system as outlined in the "Authenticity Validator for Academia" problem statement.

 Our Solution

**PramaanVault** is a multi-layered verification system that combines the immutability of blockchain with the intelligence of AI to create a tamper-proof ecosystem. Our platform allows institutions to securely issue certificates and enables recruiters to verify their authenticity in seconds, not weeks.

The verification process involves three critical checks:
1.  **Textual Verification:** OCR extracts key data from the uploaded certificate.
2.  **Structural Verification:** An SSIM-based heatmap visually identifies any pixel-level tampering or structural inconsistencies against the official template.
3.  **Integrity Verification:** The extracted data is cryptographically hashed and cross-referenced with the immutable hash stored on the blockchain ledger by the issuing university.

A comprehensive report is generated, providing a clear verdict and the evidence behind it.

## 🚀 Key Features

- **🤖 AI-Powered OCR:** Automatically extracts text details like Student Name, Roll Number, and Grades from any certificate format (PDF, JPG, PNG).
- **🎨 SSIM Heatmap Analysis:** Generates a visual heatmap to pinpoint exact areas of forgery or tampering by comparing the document's structure to a verified template.
- **🔗 Blockchain Immutability:** Certificate details (as a hash) are recorded on a Ganache-powered private blockchain, ensuring a tamper-proof "single source of truth."
- **💻 Intuitive User Interface:** A clean and modern UI for seamless interaction by University Admins and Recruiters.
- **🔐 Secure & Scalable Backend:** A robust backend to handle file processing, AI model interactions, and blockchain communications.
- - **📄 Instant Verification Reports:** Generates detailed, downloadable PDF reports for both valid and invalid certificates, providing evidence for the verification decision.

- [Invalid..pdf](https://github.com/user-attachments/files/22643033/Invalid.pdf)
- [valid.pdf](https://github.com/user-attachments/files/22643048/valid.pdf)
-<img width="1485" height="1090" alt="image" src="https://github.com/user-attachments/assets/2bf19fbf-cdb4-4db7-bd90-49080c4918ca" />
-<img width="2000" height="1414" alt="heatmap_20250929_093403" src="https://github.com/user-attachments/assets/409cca5b-a660-4eae-82f1-16ce14a0964c" />



## 🛠️ Tech Stack

**Frontend:**
- [CSS, React.js, Tailwind CSS]

**Backend:**
- [ Express.js,FastAPI]

**Machine Learning:**
- [ Python,FastAPI, EasyOCR, Scikit-image (for SSIM)]

**Blockchain:**
- **Smart Contract:** Solidity
- **Local Blockchain:** Ganache
- **Ethereum Interaction:** Web3.js / Ethers.js

**Database:**
- [ PostgreSQL]

## 🏗️ System Architecture

<img width="398" height="394" alt="image" src="https://github.com/user-attachments/assets/be453406-cbb5-4337-a2cb-0685b0ff20b1" />

A brief description of the flow:
1. The University Admin uploads certificate data, which is hashed and stored on the Blockchain via a Smart Contract.
2. The Recruiter uploads a candidate's certificate to the web portal.
3. The Backend server receives the file and sends it to the Python microservice for OCR and SSIM analysis.
4. The ML service returns the extracted text and a heatmap image.
5. The Backend hashes the extracted text and queries the blockchain to check for a matching hash.
6. A final verdict is determined, and a detailed report is generated and displayed to the Recruiter.

## ⚙️ Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

- Node.js (v18.x or higher)
- Python (v3.9 or higher)
- Ganache UI or CLI
- Metamask Browser Extension



- **University Portal:** Log in as a university admin, and issue a new certificate by entering the student's details. This will create a transaction on the blockchain.
- **Recruiter Portal:** Log in as a recruiter, upload a certificate for verification, and view the generated SSIM heatmap and final report.


## 👥 Team Members

Rohan Shelke (Team Leader) 
Swarali Patil
Pranav Mahajan
Mrunmayee Yawale
Dhruval Porwal
Aswathi Pillai
