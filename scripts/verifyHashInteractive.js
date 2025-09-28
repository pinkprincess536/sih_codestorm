// 💾 Save this file as 'scripts/verifyAll.js' or a similar name

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Papa = require("papaparse"); // A robust CSV parser
const CertificateChain = artifacts.require("CertificateChain");

module.exports = async function (callback) {
  try {
    // 🔒 Stable stringify for consistent hashing (Unchanged)
    function stableStringify(obj) {
      return JSON.stringify(
        Object.keys(obj)
          .sort()
          .reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
          }, {})
      );
    }

    // 1️⃣ Connect to the deployed contract instance
    const instance = await CertificateChain.deployed();
    console.log("🔗 Connected to blockchain");
    console.log(`📍 Contract address: ${instance.address}\n`);

    // 2️⃣ Define the path and read the CSV file
    // This path assumes your script is in a 'scripts' folder at the root of your project.
    // If you save this script at the project root, change the path to './data/certificates2.csv'
    const filePath = path.join(__dirname, "..", "data", "certificates2.csv");
    const fileContent = fs.readFileSync(filePath, "utf8");

    // 3️⃣ Parse the CSV data into an array of objects
    // The 'header: true' option automatically uses the first row as object keys.
    // This is crucial for matching the structure your hash function expects.
    const { data: certificates } = Papa.parse(fileContent, { header: true });

    console.log(`🔍 Found ${certificates.length} certificates in certificates2.csv. Starting verification...\n`);
    console.log("----------------------------------------");

    // 4️⃣ Loop through each certificate, generate its hash, and verify
    for (const cert of certificates) {
      // Generate hash (same logic as your original script)
      const candidateHash = crypto
        .createHash("sha256")
        .update(stableStringify(cert))
        .digest("hex");
      
      console.log(`\nVerifying Certificate ID: ${cert["Certificate ID"]} (Name: ${cert.Name})`);
      console.log(`🔐 Generated hash: ${candidateHash}`);

      // Verify against the blockchain
      const result = await instance.verifyCertificate(candidateHash);

      if (result[0]) {
        console.log("✅ RESULT: VALID CERTIFICATE");
        console.log(`   ⏰ Timestamp: ${new Date(parseInt(result[1]) * 1000).toLocaleString()}`);
        console.log(`   👤 Issuer: ${result[2]}`);
      } else {
        console.log("❌ RESULT: INVALID CERTIFICATE");
        console.log("   No matching record found on the blockchain.");
      }
      console.log("----------------------------------------");
    }

    console.log("\n✨ Verification process complete.");
    callback(); // Signal that the script finished successfully

  } catch (err) {
    console.error("An error occurred during verification:", err);
    callback(err); // Signal that the script failed
  }
};