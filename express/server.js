import express from "express";
import bodyParser from 'body-parser';
import path from "path";
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
// --- New imports for forwarding files ---
import axios from 'axios';
import FormData from 'form-data';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import config from '../config.js'; 

dotenv.config({ path: '../.env' }); 


const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

const port = 3000;

// --- Configuration for FastAPI Proxy ---
const FASTAPI_SERVER_URL = 'http://127.0.0.1:8000/extract-details/';


// This comment is to satisfy the linter.
// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "views"));

// --- Folder setup for storing company uploads ---
const companyDataDir = 'company_data';
const verifiedDir = config.verifiedDir;
const unverifiedDir = config.unverifiedDir;

// Create directories if they don't exist
if (!fs.existsSync(verifiedDir)) fs.mkdirSync(verifiedDir, { recursive: true });
if (!fs.existsSync(unverifiedDir)) fs.mkdirSync(unverifiedDir, { recursive: true });


// --- Existing Multer configuration for University Excel uploads ---
const uploadDir = config.uploadsDir;
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
const upload = multer({ dest: `${uploadDir}/` });
const masterCsvPath = config.csvFilePath;
//  Fixed: headers must match your DB
const masterHeaders = ['StudentID', 'FullName', 'Course', 'Grade', 'Roll', 'CertificateID'];

// --- New Multer instance for Company image uploads (uses memory storage) ---
const imageStorage = multer.memoryStorage();
const uploadImages = multer({
    storage: imageStorage,
    fileFilter: (req, file, cb) => {
        // Accept only jpg and png files
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'), false);
        }
    }
});


// --- Existing Routes (Unchanged) ---

app.get('/', (req, res) => {
    res.render("index.ejs");
});

app.get('/company-dashboard', (req, res) => {
    res.render("comp_dashboard.ejs");
});

app.get('/company-login', (req, res) => {
    res.render("comp_login.ejs");
});

app.get('/company-enrollment', (req, res) => {
    res.render("comp_enrollment.ejs");
});

// --- Modified Section for Company Upload ---

/**
 * @route   GET /company-upload
 * @desc    Renders the file upload page for the company.
 */
app.get('/company-upload', (req, res) => {
    res.render("comp_upload.ejs");
});


/**
 * @route   POST /company-upload
 * @desc    Receives certificate images, forwards them for verification, and stores them.
 */
// app.post('/company-upload', uploadImages.array('certificates'), async (req, res) => {
//     if (!req.files || req.files.length === 0) {
//         return res.status(400).json({ error: 'No files were uploaded.' });
//     }

//     const verificationPromises = req.files.map(file => {
//         console.log(`Forwarding file to FastAPI: ${file.originalname}`);

//         const formData = new FormData();
//         formData.append('file', file.buffer, {
//             filename: file.originalname,
//             contentType: file.mimetype,
//         });

//         return axios.post(FASTAPI_SERVER_URL, formData, {
//             headers: { ...formData.getHeaders() }
//         }).then(response => {
//             const result = {
//                 fileName: file.originalname,
//                 status: 'success',
//                 data: response.data
//             };

//             // --- Logic to save verified/unverified files ---
//             const isAuthentic = response.data.verification_status.includes('Authentic');
//             const saveDir = isAuthentic ? verifiedDir : unverifiedDir;
//             const timestamp = Date.now();
//             const uniqueFileName = `${timestamp}-${file.originalname}`;
//             const imagePath = path.join(saveDir, uniqueFileName);
//             const jsonPath = path.join(saveDir, `${timestamp}-${path.parse(file.originalname).name}.json`);

//             fs.writeFileSync(imagePath, file.buffer); // Save the image
//             fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2)); // Save the details JSON
//             console.log(`Saved ${file.originalname} to ${saveDir}`);

//             return result;
//         }).catch(error => {
//             const result = {
//                 fileName: file.originalname,
//                 status: 'error',
//                 error: error.response ? error.response.data.detail || 'Unknown error' : 'FastAPI server connection failed'
//             };

//             // --- Logic to save errored/unverified files ---
//             const timestamp = Date.now();
//             const uniqueFileName = `${timestamp}-${file.originalname}`;
//             const imagePath = path.join(unverifiedDir, uniqueFileName);
//             const jsonPath = path.join(unverifiedDir, `${timestamp}-${path.parse(file.originalname).name}.json`);
            
//             fs.writeFileSync(imagePath, file.buffer); // Save the image
//             fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2)); // Save the details JSON
//             console.log(`Saved ${file.originalname} to ${unverifiedDir}`);

//             return result;
//         });
//     });

//     try {
//         const results = await Promise.all(verificationPromises);
//         console.log("All files processed. Sending consolidated results back to the client.");
//         res.status(200).json({ results });
//     } catch (error) {
//         console.error("An unexpected error occurred while processing uploads:", error);
//         res.status(500).json({ error: 'An unexpected server error occurred.' });
//     }
// });


// --- Remaining Existing Routes (Unchanged) ---

app.post('/company-upload', uploadImages.array('certificates'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
    }

    const verificationPromises = req.files.map(file => {
        console.log(`Forwarding file to FastAPI: ${file.originalname}`);

        const formData = new FormData();
        formData.append('file', file.buffer, {
            filename: file.originalname,
            contentType: file.mimetype,
        });

        return axios.post(FASTAPI_SERVER_URL, formData, {
            headers: { ...formData.getHeaders() }
        }).then(response => {
            const result = {
                fileName: file.originalname,
                status: 'success',
                data: response.data
            };

            

            // --- Save verified/unverified ---
            const isAuthentic = response.data.verification_status.includes('Authentic');
            const saveDir = isAuthentic ? verifiedDir : unverifiedDir;
            const timestamp = Date.now();
            const uniqueFileName = `${timestamp}-${file.originalname}`;
            const imagePath = path.join(saveDir, uniqueFileName);
            const jsonPath = path.join(saveDir, `${timestamp}-${path.parse(file.originalname).name}.json`);

            fs.writeFileSync(imagePath, file.buffer);
            fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
            console.log(`Saved ${file.originalname} to ${saveDir}`);

            return result;
        }).catch(error => {
            const result = {
                fileName: file.originalname,
                status: 'error',
                error: error.response ? error.response.data.detail || 'Unknown error' : 'FastAPI server connection failed'
            };

            const timestamp = Date.now();
            const uniqueFileName = `${timestamp}-${file.originalname}`;
            const imagePath = path.join(unverifiedDir, uniqueFileName);
            const jsonPath = path.join(unverifiedDir, `${timestamp}-${path.parse(file.originalname).name}.json`);
            
            fs.writeFileSync(imagePath, file.buffer);
            fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
            console.log(`Saved ${file.originalname} to ${unverifiedDir}`);

            return result;
        });
    });

    try {
        const results = await Promise.all(verificationPromises);

        // ✅ Print raw JSON on server
        console.log("Verification Results:", JSON.stringify(results, null, 2));

        // ✅ Render verify_results.ejs
        res.render("verify_results.ejs", { results });
    } catch (error) {
        console.error("An unexpected error occurred while processing uploads:", error);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});


app.get('/government-login', (req, res) => {
    res.render("govt_login.ejs");
});

app.get('/government-admin', (req, res) => {
    res.render("govt_admin.ejs");
});

app.get('/university-admin', (req, res) => {
    res.render("uni_admin.ejs");
});

app.get('/university-database', (req, res) => {
    res.render("uni_database.ejs");
});

app.get('/university-upload', (req, res) => {
    res.render("uni_upload.ejs");
});

app.post('/university-upload', upload.array('excelFiles'), (req, res) => {
    console.log("Files received:", req.files);
    try {
        if (!fs.existsSync(masterCsvPath)) {
            // Ensure the directory exists
            fs.mkdirSync(path.dirname(masterCsvPath), { recursive: true });
            fs.writeFileSync(masterCsvPath, masterHeaders.join(',') + '\n');
        }

        req.files.forEach(file => {
            const workbook = xlsx.readFile(file.path);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(worksheet);

            const csvLines = jsonData.map(row => {
                const orderedRow = masterHeaders.map(header => row[header] || '');
                return orderedRow.join(',');
            }).join('\n');
            
            if (csvLines) {
                 fs.appendFileSync(masterCsvPath, csvLines + '\n');
            }
        });

        console.log(' CSV file has been successfully updated.');

        // --- NEW: AUTOMATICALLY RUN THE DATABASE IMPORT SCRIPT ---
        console.log('🚀 Triggering database import script...');
        
        const command = `node ${config.exportScriptPath}`;

        exec(command, (error, stdout, stderr) => {
            req.files.forEach(file => {
                fs.unlinkSync(file.path);
            });

            if (error) {
                console.error(` Error executing exportcert.js: ${error.message}`);
                console.error(`Script stderr: ${stderr}`);
                return res.status(500).send('Files processed, but failed to sync with the database.');
            }
            
            console.log(` Database import script finished successfully.`);
            console.log(`Script stdout: ${stdout}`);
            res.status(200).send('Files successfully uploaded and synced with the database.');
        });

    } catch (error) {
        console.error("Error processing files:", error);
        req.files.forEach(file => {
            fs.unlinkSync(file.path);
        });
        res.status(500).send('An error occurred during file processing.');
    }
});

app.get('/university-login', (req, res) => {
    res.render("uni_login.ejs");
});

app.get('/verify-results', (req, res) => {
    try {
        const results = [];

        // Read both verified and unverified folders
        [verifiedDir, unverifiedDir].forEach(folder => {
            if (fs.existsSync(folder)) {
                const files = fs.readdirSync(folder);
                files.forEach(file => {
                    if (file.endsWith('.json')) {
                        const data = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf-8'));
                        results.push({
                            fileName: data.fileName,
                            candidate_name: data.data?.recipient_name || 'N/A',
                            verification_status: data.data?.verification_status || 'Unknown',
                            uploaded_at: fs.statSync(path.join(folder, file)).mtime // use file modified time
                        });
                    }
                });
            }
        });
        const sortedResults = results.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
        res.render("verify_results.ejs", { results: sortedResults })
    } catch (err) {
        console.error("Error fetching verification results:", err);
        res.status(500).send("Error fetching verification results.");
    }
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

