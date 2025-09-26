import express from "express";
import bodyParser from 'body-parser';
import path from "path";
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
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
    try {
        res.render("index.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/company-dashboard', (req, res) => {
    try {
        res.render("company-routes/comp_dashboard.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/company-login', (req, res) => {
    try {
        res.render("company-routes/comp_login.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/company-enrollment', (req, res) => {
    try {
        res.render("company-routes/comp_enrollment.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/company-upload', (req, res) => {
    try {
        res.render("company-routes/comp_upload.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.post('/company-upload', uploadImages.array('certificates'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });  //checking if any file is sent in the request or not 
    }

    const verificationPromises = req.files.map(file => {
        console.log(`Forwarding file to FastAPI: ${file.originalname}`);    //Step-1 : sending every file ONE-BY-ONE to the fastapi server

        const formData = new FormData();
        formData.append('file', file.buffer, {  //Step-2 : creating a sample HTML form to send the data (this is how data is sent bw servers as forms)
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

        //      Print raw JSON on server
        console.log("Verification Results:", JSON.stringify(results, null, 2));

        //  Render verify_results.ejs
        res.render("company-routes/verify_results.ejs", { results });
    } catch (error) {
        console.error("An unexpected error occurred while processing uploads:", error);
        res.status(500).json({ error: 'An unexpected server error occurred.' });
    }
});


app.get('/government-login', (req, res) => {
    try {
        res.render("government-routes/govt_login.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/government-admin', (req, res) => {
    
    try {
        res.render("government-routes/govt_admin.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/university-admin', (req, res) => {
    
    try {
        res.render("university-routes/uni_admin.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/university-database', (req, res) => {
    
    try {
        res.render("university-routes/uni_database.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
});

app.get('/university-upload', (req, res) => {
    
    try {
        res.render("university-routes/uni_upload.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
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
        console.log(' Triggering database import script...');
        
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
            alert('Files successfully uploaded and synced with the database.');
            res.status(200).res.render("university-routes/uni_upload.ejs")
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
    
    try {
        res.render("university-routes/uni_login.ejs");
    }
    catch(err) {
        console.error("There was some error processing your request.\n",err.message);
        res.json({"error" : err.message});
    }
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
        res.render("company-routes/verify_results.ejs", { results: sortedResults })
    } catch (err) {
        console.error("Error fetching verification results:", err);
        res.status(500).send("Error fetching verification results.");
    }
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

