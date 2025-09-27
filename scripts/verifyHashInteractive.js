const readline = require("readline");
const crypto = require("crypto");
const CertificateChain = artifacts.require("CertificateChain");

module.exports = async function (callback) {
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 🔒 Stable stringify for consistent hashing
    function stableStringify(obj) {
      return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {})
      );
    }

    // 1️⃣ Prompt user for details (exactly matching CSV headers)
    rl.question("Enter student Name: ", (name) => {
      rl.question("Enter University: ", (university) => {
        rl.question("Enter Roll Number: ", (rollNumber) => {
          rl.question("Enter Certificate ID: ", (certificateId) => {
            rl.question("Enter Degree Name: ", (degreeName) => {
              rl.question("Enter Grade: ", async (grade) => {
                
                // 2️⃣ Build object with EXACT keys from certificates2.csv
                const studentData = {
                  "Name": name,
                  "University": university,
                  "Roll Number": rollNumber,
                  "Certificate ID": certificateId,
                  "Degree Name": degreeName,
                  "Grade": grade,
                };

                // 3️⃣ Generate hash (same as CSV batch script)
                const candidateHash = crypto
                  .createHash("sha256")
                  .update(stableStringify(studentData))
                  .digest("hex");

                console.log(`\n🔐 Generated hash: ${candidateHash}`);

                // 4️⃣ Verify against blockchain
                const instance = await CertificateChain.deployed();
                console.log("\n🔗 Connected to blockchain");
                console.log(`📍 Contract address: ${instance.address}`);

                const result = await instance.verifyCertificate(candidateHash);

                if (result[0]) {
                  console.log("\n✅ VALID CERTIFICATE");
                  console.log(`   ⏰ Timestamp: ${new Date(parseInt(result[1]) * 1000).toLocaleString()}`);
                  console.log(`   👤 Issuer: ${result[2]}`);
                } else {
                  console.log("\n❌ INVALID CERTIFICATE");
                  console.log("   No matching record found on the blockchain.");
                }

                rl.close();
                callback();
              });
            });
          });
        });
      });
    });
  } catch (err) {
    callback(err);
  }
};
