// scripts/exportcert.js
const fs = require("fs");
const csv = require("csv-parser"); // ✅ correct
const crypto = require("crypto");
const { Client } = require("pg");
require("dotenv").config();
const path = require("path");

async function importCSV() {
    console.log("🚀 Starting CSV import process...");
    const client = new Client(
        "postgresql://neondb_owner:npg_cUguGBil1AI2@ep-empty-cake-ad2pyf2h-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
    );

    try {
        await client.connect();
        console.log("🗄️ Database connected successfully.");

        await new Promise((resolve, reject) => {
            const results = [];
            const csvFilePath = path.join(__dirname, "../../data/certificates.csv");

            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on("data", (row) => results.push(row))
                .on("error", (err) => {
                    console.error("❌ Error reading CSV stream:", err);
                    reject(err);
                })
                .on("end", async () => {
                    try {
                        console.log(`📄 CSV Loaded: ${results.length} rows. Starting database insertion...`);
                        let successCount = 0;

                        for (const row of results) {
                            const roll = row.Roll && row.Roll.trim() !== "" ? parseInt(row.Roll, 10) : null;

                            if (roll === null) {
                                console.warn(`⚠️ Skipping row with missing Roll:`, row);
                                continue;
                            }

                            // 🔑 Hash fields (match your schema order)
                            const fieldsToHash = [row.FullName, row.Course, row.Grade, row.Roll, row.CertificateID];
                            const standardizedFields = fieldsToHash.map((field) =>
                                String(field || "").toLowerCase().trim()
                            );
                            const concatenatedString = standardizedFields.join("|");

                            console.log(`[Node.js HASH INPUT]: ${concatenatedString}`);
                            const hash = crypto.createHash("sha256").update(concatenatedString).digest("hex");

                            // ✅ Fixed query: matches updated schema (no Branch, no Year)
                            const query = `
                                INSERT INTO student_details ("Roll", "Name", "Course", "Grade", "Certificate_ID", "Original_Hash")
                                VALUES ($1, $2, $3, $4, $5, $6)
                                ON CONFLICT ("Roll") DO UPDATE 
                                SET "Name" = EXCLUDED."Name",
                                    "Course" = EXCLUDED."Course",
                                    "Grade" = EXCLUDED."Grade",
                                    "Certificate_ID" = EXCLUDED."Certificate_ID",
                                    "Original_Hash" = EXCLUDED."Original_Hash"
                            `;

                            try {
                                await client.query(query, [
                                    roll,
                                    row.FullName,
                                    row.Course,
                                    row.Grade,
                                    row.CertificateID,
                                    hash,
                                ]);
                                console.log(`✅ Inserted/Updated row for Roll: ${roll}, Name: ${row.FullName}`);
                                successCount++;
                            } catch (insertErr) {
                                console.error("❌ Insert failed for row:", row, "\nError:", insertErr);
                            }
                        }

                        console.log(`✅ Successfully processed and sent ${successCount} rows to the database.`);
                        resolve();
                    } catch (dbError) {
                        console.error("❌ A database error occurred during insertion:", dbError);
                        reject(dbError);
                    }
                });
        });
    } catch (err) {
        console.error("❌ An unexpected error occurred in the import process:", err);
    } finally {
        if (client) {
            await client.end();
            console.log("🚪 Database connection closed.");
        }
    }
}

importCSV();




// // scripts/exportcert.js
// const fs = require("fs");
// const csv = require("csv-parser"); // <-- CORRECTED THIS LINE
// const crypto = require("crypto");
// const { Client } = require("pg");
// require("dotenv").config();
// const path = require("path");

// async function importCSV() {
//     console.log("🚀 Starting CSV import process...");
//     const client = new Client('postgresql://neondb_owner:npg_cUguGBil1AI2@ep-empty-cake-ad2pyf2h-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require');

//     try {
//         await client.connect();
//         console.log("🗄️ Database connected successfully.");

//         await new Promise((resolve, reject) => {
//             const results = [];
//             const csvFilePath = path.join(__dirname, "../../data/certificates.csv");

//             fs.createReadStream(csvFilePath)
//                 .pipe(csv())
//                 .on("data", (row) => results.push(row))
//                 .on("error", (err) => {
//                     console.error("❌ Error reading CSV stream:", err);
//                     reject(err);
//                 })
//                 .on("end", async () => {
//                     try {
//                         console.log(`📄 CSV Loaded: ${results.length} rows. Starting database insertion...`);
//                         let successCount = 0;

//                         for (const row of results) {
//                             const roll = row.Roll && row.Roll.trim() !== "" ? parseInt(row.Roll, 10) : null;
//                             const year = row.GraduationYear && row.GraduationYear.trim() !== "" ? parseInt(row.GraduationYear, 10) : null;

//                             if (roll === null) {
//                                 console.warn(`⚠️ Skipping row with missing Roll:`, row);
//                                 continue;
//                             }

//                             const fieldsToHash = [row.FullName,row.Course,row.Grade,row.Roll, row.CertificateID];
//                             const standardizedFields = fieldsToHash.map(field => String(field || '').toLowerCase().trim());
//                             const concatenatedString = standardizedFields.join('|');
//                             // --- ADD THIS LOG ---
//                             console.log(`[Node.js HASH INPUT]: ${concatenatedString}`);
//                             const hash = crypto.createHash("sha256").update(concatenatedString).digest("hex");

//                             await client.query(
//                                 `INSERT INTO student_details ("Roll", "Name", "Course", "Grade", "Certificate_ID", "Original_Hash")
//                                 VALUES ($1, $2, $3, $4, $5, $6)
//                                 ON CONFLICT ("Roll") DO UPDATE 
//                                 SET "Name" = EXCLUDED."Name",
//                                     "Course" = EXCLUDED."Course",
//                                     "Grade" = EXCLUDED."Grade",
//                                     "Certificate_ID" = EXCLUDED."Certificate_ID",
//                                     "Original_Hash" = EXCLUDED."Original_Hash"`,
//                                 [roll, row.FullName, row.Course, row.Grade, row.CertificateID, hash]
//                                 );

//                             successCount++;
//                         }
                        
//                         console.log(`✅ Successfully processed and sent ${successCount} rows to the database.`);
//                         resolve(); 
//                     } catch (dbError) {
//                         console.error("❌ A database error occurred during insertion:", dbError);
//                         reject(dbError); 
//                     }
//                 });
//         });

//     } catch (err) {
//         console.error("❌ An unexpected error occurred in the import process:", err);
//     } finally {
//         if (client) {
//             await client.end();
//             console.log("🚪 Database connection closed.");
//         }
//     }
// }

// importCSV();







// // scripts/exportcert.js
// const fs = require("fs");
// const csv = require("csv-parser");
// const crypto = require("crypto");
// const { Client } = require("pg");
// require('dotenv').config({ path: '../../.env' });
// const config = require('../../config');
// const path = require("path");

// async function importCSV() {
//     console.log(" Starting CSV import process...");
//     const client = new Client(process.env.DATABASE_URL);

//     try {
//         await client.connect();
//         console.log(" Database connected successfully.");

//         await new Promise((resolve, reject) => {
//             const results = [];
//             const csvFilePath = config.csvFilePath;

//             fs.createReadStream(csvFilePath)
//                 .pipe(csv())
//                 .on("data", (row) => results.push(row))
//                 .on("error", (err) => reject(err))
//                 .on("end", async () => {
//                     try {
//                         console.log(` CSV Loaded: ${results.length} rows.`);

//                         for (const row of results) {
//                             const roll = row.Roll && row.Roll.trim() !== "" ? parseInt(row.Roll, 10) : null;

//                             if (roll === null) {
//                                 console.warn(` Skipping row with missing Roll:`, row);
//                                 continue;
//                             }

//                             // Dynamic hash: skip null/empty
//                             const fieldsToHash = [row.FullName, row.Course, row.Grade, row.Roll, row.CertificateID];
//                             const filteredFields = fieldsToHash.filter(
//                                 (field) => field !== null && field !== undefined && String(field).trim() !== ""
//                             );

//                             const standardizedFields = filteredFields.map((field) =>
//                                 String(field).toLowerCase().trim()
//                             );
//                             const concatenatedString = standardizedFields.join("|");

//                             console.log(`[Node.js HASH INPUT]: ${concatenatedString}`);
//                             const hash = crypto.createHash("sha256").update(concatenatedString).digest("hex");

//                             const query = `
//                                 INSERT INTO student_details ("Roll", "Name", "Course", "Grade", "Certificate_ID", "Original_Hash")
//                                 VALUES ($1, $2, $3, $4, $5, $6)
//                                 ON CONFLICT ("Roll") DO UPDATE 
//                                 SET "Name" = EXCLUDED."Name",
//                                     "Course" = EXCLUDED."Course",
//                                     "Grade" = EXCLUDED."Grade",
//                                     "Certificate_ID" = EXCLUDED."Certificate_ID",
//                                     "Original_Hash" = EXCLUDED."Original_Hash"
//                             `;

//                             await client.query(query, [
//                                 roll,
//                                 row.FullName || null,
//                                 row.Course || null,
//                                 row.Grade || null,
//                                 row.CertificateID || null,
//                                 hash,
//                             ]);
//                             console.log(` Inserted/Updated row for Roll: ${roll}, Name: ${row.FullName}`);
//                         }

//                         resolve();
//                     } catch (dbError) {
//                         reject(dbError);
//                     }
//                 });
//         });
//     } catch (err) {
//         console.error(" Import process error:", err);
//     } finally {
//         if (client) {
//             await client.end();
//             console.log(" Database connection closed.");
//         }
//     }
// }

// importCSV();
