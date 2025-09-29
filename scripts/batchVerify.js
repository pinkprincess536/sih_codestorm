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
    console.log(`📂 CSV File: ${csvFile}`);
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

    console.log(`✅ Found ${records.length} certificates to verify\n`);

    const instance = await CertificateChain.deployed();
    console.log("🔗 Connected to blockchain");
    console.log(`📍 Contract address: ${instance.address}`);
    console.log("-".repeat(50));

    let validCount = 0;
    let invalidCount = 0;
    const results = [];
    const startTime = Date.now();

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      // Generate hash from extracted data
      const extractedHash = crypto
        .createHash("sha256")
        .update(stableStringify(record))
        .digest("hex");

      try {
        // Verify against blockchain
        const blockchainResult = await instance.verifyCertificate(extractedHash);
        
        const certificateResult = {
          index: i + 1,
          university: record["University Name"],
          name: record["Certificate Holder Name"],
          course: record["Course"],
          grade: record["Grade"],
          rollNumber: record["Roll No"],
          certificateId: record["Certificate ID"],
          extractedHash: extractedHash,
          shortHash: extractedHash.substring(0, 12) + "...",
          isValid: blockchainResult[0],
          status: blockchainResult[0] ? "VALID" : "INVALID",
          timestamp: blockchainResult[1] ? blockchainResult[1].toString() : null,
          issuer: blockchainResult[2] || null,
          verificationTime: new Date().toISOString()
        };

        results.push(certificateResult);

        if (reportType !== "json-only") {
          const progress = `[${i + 1}/${records.length}]`;
          if (blockchainResult[0]) {
            validCount++;
            console.log(`✅ ${progress} ${certificateResult.status} - ${certificateResult.name} (${certificateResult.university})`);
            console.log(`   Hash Match: ${certificateResult.shortHash}`);
          } else {
            invalidCount++;
            console.log(`❌ ${progress} ${certificateResult.status} - ${certificateResult.name} (${certificateResult.university})`);
            console.log(`   Hash Mismatch: ${certificateResult.shortHash}`);
          }
        }
      } catch (verifyError) {
        console.error(`❌ Error verifying ${record["Certificate Holder Name"]}: ${verifyError.message}`);
        invalidCount++;
        
        results.push({
          index: i + 1,
          university: record["University Name"],
          name: record["Certificate Holder Name"],
          course: record["Course"],
          grade: record["Grade"],
          rollNumber: record["Roll No"],
          certificateId: record["Certificate ID"],
          extractedHash: extractedHash,
          shortHash: extractedHash.substring(0, 12) + "...",
          isValid: false,
          status: "INVALID",
          error: verifyError.message,
          verificationTime: new Date().toISOString()
        });
      }
    }

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    // Print Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Valid Certificates:   ${validCount}`);
    console.log(`❌ Invalid Certificates: ${invalidCount}`);
    console.log(`📝 Total Processed:      ${records.length}`);
    console.log(`⏱️  Total Time:           ${totalTime}s`);
    console.log("=".repeat(50));

    // Save results with status to JSON
    const outputJSONFile = path.join(
      path.dirname(csvFile),
      path.basename(csvFile, ".csv") + "_verification_results.json"
    );
    fs.writeFileSync(outputJSONFile, JSON.stringify(results, null, 2));
    console.log(`💾 Verification results saved to: ${outputJSONFile}`);

    // Update CSV with hash and status columns
    const outputCSVFile = path.join(
      path.dirname(csvFile),
      path.basename(csvFile, ".csv") + "_with_verification.csv"
    );
    
    const csvLines = [
      "University Name,Certificate Holder Name,Course,Grade,Roll No,Certificate ID"
    ];
    
    results.forEach(r => {
      csvLines.push([
        r.university,
        r.name,
        r.course,
        r.grade,
        r.rollNumber,
        r.certificateId,
  
      ].map(f => `"${f}"`).join(","));
    });
    
    fs.writeFileSync(outputCSVFile, csvLines.join("\n"));
    console.log(`💾 Updated CSV saved with Hash and Status: ${outputCSVFile}`);

    callback();
  } catch (err) {
    console.error("\n❌ VERIFICATION FAILED:");
    console.error(err.message);
    callback(err);
  }
};