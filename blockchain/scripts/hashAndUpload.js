const fs = require("fs");
const parse = require("csv-parse/lib/sync");
const crypto = require("crypto");

const CertificateChain = artifacts.require("CertificateChain");

module.exports = async function (callback) {
  try {
    // 1️⃣ Read CSV
    const fileContent = fs.readFileSync("data/certificates.csv");
    const records = parse(fileContent, { columns: true });

    // 2️⃣ Hash each row
    const hashes = records.map(row =>
      crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex")
    );

    console.log("Generated hashes:", hashes);

    // 3️⃣ Get deployed contract instance
    const instance = await CertificateChain.deployed();

    // 4️⃣ Batch insert
    const tx = await instance.addBatch(hashes);
    console.log("Transaction successful:", tx.tx);

    callback();
  } catch (err) {
    callback(err);
  }
};
