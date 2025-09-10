import express from "express";
import bodyParser from 'body-parser';
import path from "path";
import multer from 'multer';
import xlsx from 'xlsx'; 
import fs from 'fs'; 

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));

const port = 3000;

// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "views"));

const uploadDir = 'uploads'; 
if (!fs.existsSync(uploadDir)) { 
    fs.mkdirSync(uploadDir); 
}
const upload = multer({ dest: `${uploadDir}/` }); 
const masterCsvPath = 'data.csv'; 
const masterHeaders = ['StudentID', 'FullName', 'Course', 'GraduationYear', 'CertificateID'];


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

app.get('/company-upload', (req, res) => {
    res.render("comp_upload.ejs");
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

app.post('/university-upload', upload.array('excelFiles'), (req, res) => { //uploading in bulk using upload.array
        console.log("Files received:", req.files);
    try { 
        if (!fs.existsSync(masterCsvPath)) { //creating the db if not exists
            fs.writeFileSync(masterCsvPath, masterHeaders.join(',') + '\n'); 
        } 

        req.files.forEach(file => {
            const workbook = xlsx.readFile(file.path); // storing all the files recieved, one by one, in the request
            const sheetName = workbook.SheetNames[0]; // for every file you get the name of the first sheet
            const worksheet = workbook.Sheets[sheetName]; // getting data of the first sheet inside worksheet ( so our code doesnt work for multi sheet excel files )
            const jsonData = xlsx.utils.sheet_to_json(worksheet); // converted the entire worksheet to a json object

            /*[
            { StudentID: 101, FullName: 'Alice', Course: 'CS', GraduationYear: 2024, CertificateID: 'CERT001' },
            { StudentID: 102, FullName: 'Bob', Course: 'ME', GraduationYear: 2023, CertificateID: 'CERT002' },
            { StudentID: 103, FullName: 'Charlie', Course: 'CE', GraduationYear: 2025, CertificateID: 'CERT003' }
            ] */

            const csvLines = jsonData.map(row => { // getting every row -> and storing it if it exists and " " if it doesnt into a string joined by ,
                const orderedRow = masterHeaders.map(header => row[header] || ''); 
                return orderedRow.join(','); 
            }).join('\n'); // storing all such strings into a single string separated by \n

            fs.appendFileSync(masterCsvPath, csvLines + '\n'); 
        });

        res.status(200).send('Files successfully uploaded and processed.'); 

    } catch (error) {
        console.error("Error processing files:", error);
        res.status(500).send('An error occurred during file processing.');
    } finally { // clearing up our temporary storage foldeer uploads
        req.files.forEach(file => { 
            fs.unlinkSync(file.path); 
        }); 
    } 
});

app.get('/university-login', (req, res) => {
    res.render("uni_login.ejs");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});