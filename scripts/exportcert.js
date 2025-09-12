// scripts/exportcert.js
const fs = require("fs");
const csv = require("csv-parser");
const crypto = require("crypto");
const { Client } = require("pg");
require("dotenv").config();

async function importCSV() {
  const client = new Client(
    'postgresql://neondb_owner:npg_4MB2YDCKGjqO@ep-delicate-bonus-a157g29v-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  );

  try {
    await client.connect();

    const results = [];

    fs.createReadStream("data/certificates.csv")
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", async () => {
        console.log(`📄 CSV Loaded: ${results.length} rows`);

        let successCount = 0;
        let failCount = 0;

        for (let row of results) {
          try {
            // Convert Roll and Year safely
            const roll =
              row.Roll && row.Roll.trim() !== "" ? parseInt(row.Roll, 10) : null;
            const year =
              row.Year && row.Year.trim() !== "" ? parseInt(row.Year, 10) : null;

            // Skip row if Roll is null (primary key cannot be null)
            if (roll === null) {
              console.warn(`⚠️ Skipping row with missing Roll:`, row);
              failCount++;
              continue;
            }

            // Generate SHA-256 hash of the row
            const hash = crypto
              .createHash("sha256")
              .update(JSON.stringify(row))
              .digest("hex");

            // Insert row into PostgreSQL
            await client.query(
              `INSERT INTO student_details ("Roll", "Name", "Course", "Branch", "Grade", "Year", "Original_Hash")
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT ("Roll") DO UPDATE 
               SET "Name" = EXCLUDED."Name",
                   "Course" = EXCLUDED."Course",
                   "Branch" = EXCLUDED."Branch",
                   "Grade" = EXCLUDED."Grade",
                   "Year" = EXCLUDED."Year",
                   "Original_Hash" = EXCLUDED."Original_Hash"`,
              [roll, row.Name, row.Course, row.Branch, row.Grade, year, hash]
            );

            successCount++;
          } catch (err) {
            console.error("❌ Failed to insert row:", row, "\nError:", err.message);
            failCount++;
          }
        }

        console.log(`✅ Import complete. Success: ${successCount}, Failed: ${failCount}`);

        await client.end();
      })
      .on("error", (err) => {
        console.error("❌ Error reading CSV:", err);
      });
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    await client.end();
  }
}

importCSV();
