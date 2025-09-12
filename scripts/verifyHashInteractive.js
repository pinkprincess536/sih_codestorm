const readline = require("readline");
const crypto = require("crypto");
const CertificateChain = artifacts.require("CertificateChain");

module.exports = async function (callback) {
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 1️⃣ Prompt user for all six student details
    rl.question("Enter student Roll No: ", (rollNo) => {
      rl.question("Enter student Name: ", (name) => {
        rl.question("Enter student Course: ", (course) => {
          rl.question("Enter student Branch: ", (branch) => {
            rl.question("Enter student Grade: ", (grade) => {
              rl.question("Enter student Year: ", async (year) => {
                
                // 2️⃣ Create an object with user input, using exact CSV headers as keys
                // The keys MUST be identical to the headers in your certificates.csv
                const studentData = {
                  "Roll No": rollNo,
                  "Name": name,
                  "Course": course,
                  "Branch": branch,
                  "Grade": grade,
                  "Year": year,
                };
                
                // 3️⃣ Generate the hash using the exact same logic
                // The stringified JSON must be identical to what was generated from the CSV
                const candidateHash = crypto
                  .createHash("sha256")
                  .update(JSON.stringify(studentData))
                  .digest("hex");

                console.log(`\nGenerated hash: ${candidateHash}`);

                // 4️⃣ Verify the new hash against the blockchain
                const instance = await CertificateChain.deployed();
                const result = await instance.verifyCertificate(candidateHash);

                if (result[0]) {
                  console.log("\n VALID CERTIFICATE");
                  console.log(`   Timestamp: ${result[1]}`);
                  console.log(`   Issuer: ${result[2]}`);
                } else {
                  console.log("\n INVALID CERTIFICATE");
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