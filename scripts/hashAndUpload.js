const fs = require("fs");
const { parse } = require("csv-parse/sync");
const crypto = require("crypto");
const CertificateChain = artifacts.require("CertificateChain");

//truffle migrate --reset --network development
//truffle exec scripts/hashAndUpload.js --network development

module.exports = async function (callback) {
  console.log("Connecting to Ganache GUI...");
  try {
    // Function to create stable string for hashing
    function stableStringify(obj) {
      return JSON.stringify(
        Object.keys(obj).sort().reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {})
      );
    }

    // 1️⃣ Read CSV
    const csvPath = "data/certificates.csv";
    const fileContent = fs.readFileSync(csvPath);
    const records = parse(fileContent, { columns: true });

    // Ensure hash column exists
    records.forEach(r => {
      if (!r.hasOwnProperty("hash")) r["hash"] = "";
    });

    // 2️⃣ Hash each row and store in the hash column
    const hashes = records.map(row => {
      const hash = crypto.createHash("sha256").update(stableStringify(row)).digest("hex");
      row["hash"] = hash;
      return hash;
    });

    console.log("Generated hashes:", hashes);

    // 3️⃣ Save updated CSV with hash column
    const headers = [
      "University Name",
      "Certificate Holder Name",
      "Course",
      "Grade",
      "Roll No",
      "Certificate ID",
      "hash"
    ];
    const csvLines = [headers.join(",")];

    records.forEach(r => {
      const rowValues = headers.map(h => `"${r[h] || ""}"`);
      csvLines.push(rowValues.join(","));
    });

    const updatedCSVPath = "data/certificates_with_hash.csv";
    fs.writeFileSync(updatedCSVPath, csvLines.join("\n"));
    console.log(`💾 Updated CSV saved with hash column: ${updatedCSVPath}`);

    // 4️⃣ Get deployed contract instance
    const instance = await CertificateChain.deployed();
    console.log("Contract instance obtained:", instance.address);

    // 5️⃣ Batch insert into blockchain
    const tx = await instance.addBatch(hashes);
    console.log("Transaction successful:", tx.tx);
    console.log(`Successfully uploaded ${hashes.length} hashes to blockchain`);
    console.log("Transaction hash:", tx.tx);

    callback();
  } catch (err) {
    callback(err);
  }
};
