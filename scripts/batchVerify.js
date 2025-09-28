const fs = require("fs");
const { parse } = require("csv-parse/sync");
const crypto = require("crypto");
const CertificateChain = artifacts.require("CertificateChain");

module.exports = async function (callback) {
  try {
    // --- Configuration ---
    const csvFile = "data/certificates2.csv";
    console.log("🔍 BATCH CERTIFICATE VERIFICATION");
    console.log("=".repeat(50));
    console.log(`📁 Verifying records in: ${csvFile}`);
    console.log("=".repeat(50));

    // --- Helper function for consistent hashing ---
    function stableStringify(obj) {
      return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {})
      );
    }

    // --- Read and Validate CSV ---
    if (!fs.existsSync(csvFile)) {
      throw new Error(`CSV file not found: ${csvFile}`);
    }

    const fileContent = fs.readFileSync(csvFile);
    const records = parse(fileContent, { columns: true });
    if (records.length === 0) {
      throw new Error("CSV file is empty or has no valid records");
    }
    console.log(`✅ Found ${records.length} certificates to verify\n`);

    // --- Connect to Blockchain ---
    const instance = await CertificateChain.deployed();
    console.log("🔗 Connected to blockchain");
    console.log(`📍 Contract address: ${instance.address}`);
    console.log("-".repeat(50));

    // --- Verification Loop ---
    let validCount = 0;
    let invalidCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const progress = `[${i + 1}/${records.length}]`;

      const certificateData = {
        "University Name": record["University Name"],
        "Certificate Holder Name": record["Certificate Holder Name"],
        "Course": record["Course"],
        "Grade": record["Grade"],
        "Roll No": record["Roll No"],
        "Certificate ID": record["Certificate ID"],
      };

      const candidateHash = crypto
        .createHash("sha256")
        .update(stableStringify(certificateData))
        .digest("hex");

      try {
        // Capture the full array-like result from the contract.
        const result = await instance.verifyCertificate(candidateHash);
        // The actual boolean is the FIRST element of the result.
        const isValid = result[0];
        
        if (isValid) {
          validCount++;
          console.log(`✅ ${progress} VALID   - ${record["Certificate Holder Name"]}`);
        } else {
          invalidCount++;
          console.log(`❌ ${progress} INVALID - ${record["Certificate Holder Name"]}`);
        }
      } catch (verifyError) {
        console.error(`🚨 ${progress} ERROR   - Verifying ${record["Certificate Holder Name"]}: ${verifyError.message}`);
        invalidCount++;
      }
    }

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    // --- Final Summary Report ---
    console.log("\n" + "=".repeat(50));
    console.log("📊 VERIFICATION SUMMARY");
    console.log("-".repeat(50));
    console.log(`Total Records Checked: ${records.length}`);
    console.log(`✅ Valid Certificates:  ${validCount}`);
    console.log(`❌ Invalid Certificates: ${invalidCount}`);
    console.log(`⏱️  Total Time:          ${totalTime} seconds`);
    console.log("=".repeat(50));

    callback();
  } catch (err) {
    console.error("\n❌ SCRIPT FAILED:");
    console.error(err.message);
    callback(err);
  }
};