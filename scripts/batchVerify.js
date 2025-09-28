const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const crypto = require("crypto");
const CertificateChain = artifacts.require("CertificateChain");

module.exports = async function (callback) {
  try {
    const args = process.argv.slice(2);
    let csvFile = "data/certificates2.csv"; // default
    let reportType = "summary"; // options: summary, detailed, json-only

    const fileArg = args.find(arg => arg.startsWith('--file='));
    if (fileArg) {
      csvFile = fileArg.split('=')[1].replace(/['"]/g, '');
    }
    const reportArg = args.find(arg => arg.startsWith('--report='));
    if (reportArg) {
      reportType = reportArg.split('=')[1].replace(/['"]/g, '');
    }

    console.log("🔍 BATCH CERTIFICATE VERIFICATION");
    console.log("=".repeat(50));
    console.log(`📁 CSV File: ${csvFile}`);
    console.log(`📊 Report Type: ${reportType}`);
    console.log("=".repeat(50));

    function stableStringify(obj) {
      return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {})
      );
    }

    if (!fs.existsSync(csvFile)) {
      throw new Error(`CSV file not found: ${csvFile}`);
    }

    const fileContent = fs.readFileSync(csvFile);
    const records = parse(fileContent, { columns: true });
    if (records.length === 0) {
      throw new Error("CSV file is empty or has no valid records");
    }

    // ✅ match your CSV headers
    const requiredColumns = [
      "University Name",
      "Certificate Holder Name",
      "Course",
      "Grade",
      "Roll No",
      "Certificate ID"
    ];
    const csvColumns = Object.keys(records[0]);
    const missingColumns = requiredColumns.filter(col => !csvColumns.includes(col));
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(", ")}`);
    }

    // Ensure hash column exists
    if (!records[0].hasOwnProperty("hash")) {
      records.forEach(r => r.hash = "");
    }

    console.log(`✅ Found ${records.length} certificates to verify\n`);

    const instance = await CertificateChain.deployed();
    console.log("🔗 Connected to blockchain");
    console.log(`📍 Contract address: ${instance.address}`);
    console.log("-".repeat(50));

    let validCount = 0;
    let invalidCount = 0;
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const candidateHash = crypto
        .createHash("sha256")
        .update(stableStringify(record))
        .digest("hex");

      // Store hash in the CSV row
      record.hash = candidateHash;

      try {
        const blockchainResult = await instance.verifyCertificate(candidateHash);
        const certificateResult = {
          index: i + 1,
          university: record["University Name"],
          name: record["Certificate Holder Name"],
          course: record["Course"],
          grade: record["Grade"],
          rollNumber: record["Roll No"],
          certificateId: record["Certificate ID"],
          hash: candidateHash,
          shortHash: candidateHash.substring(0, 12) + "...",
          isValid: blockchainResult[0],
          timestamp: blockchainResult[1] ? blockchainResult[1].toString() : null,
          issuer: blockchainResult[2] || null,
          verificationTime: new Date().toISOString()
        };

        results.push(certificateResult);

        if (reportType !== "json-only") {
          const progress = `[${i + 1}/${records.length}]`;
          if (blockchainResult[0]) {
            validCount++;
            console.log(`✅ ${progress} VALID - ${certificateResult.name} (${certificateResult.university})`);
          } else {
            invalidCount++;
            console.log(`❌ ${progress} INVALID - ${certificateResult.name} (${certificateResult.university})`);
          }
        }
      } catch (verifyError) {
        console.error(`❌ Error verifying ${record["Certificate Holder Name"]}: ${verifyError.message}`);
        invalidCount++;
      }
    }

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    // Save updated CSV with hash column
    const outputCSVFile = path.join(
      path.dirname(csvFile),
      path.basename(csvFile, ".csv") + "_with_hash.csv"
    );
    const csvLines = [
      "University Name,Certificate Holder Name,Course,Grade,Roll No,Certificate ID,hash"
    ];
    records.forEach(r => {
      csvLines.push([
        r["University Name"],
        r["Certificate Holder Name"],
        r["Course"],
        r["Grade"],
        r["Roll No"],
        r["Certificate ID"],
        r["hash"]
      ].map(f => `"${f}"`).join(","));
    });
    fs.writeFileSync(outputCSVFile, csvLines.join("\n"));
    console.log(`💾 Updated CSV saved with hash column: ${outputCSVFile}`);

    callback();
  } catch (err) {
    console.error("\n❌ VERIFICATION FAILED:");
    console.error(err.message);
    callback(err);
  }
};
