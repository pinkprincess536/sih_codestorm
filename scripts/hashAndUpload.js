const fs = require("fs");
const { parse } = require("csv-parse/sync");
const crypto = require("crypto");

const CertificateChain = artifacts.require("CertificateChain");
//truffle migrate --reset --network development
//truffle exec scripts/hashAndUpload.js --network development
//truffle exec scripts/verifyHashInteractive.js --network development
module.exports = async function (callback) {
  console.log("Connecting to Ganache GUI...");
  try {
    //STABILITY
    function stableStringify(obj) {
    return JSON.stringify(
    Object.keys(obj).sort().reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {})
  );
  }
    // 1️⃣ Read CSV
    const fileContent = fs.readFileSync("data/certificates.csv");
    const records = parse(fileContent, { columns: true });

    // 2️⃣ Hash each row
    const hashes = records.map(row =>
    crypto.createHash("sha256").update(stableStringify(row)).digest("hex")
);

    console.log("Generated hashes:", hashes);

    // 3️⃣ Get deployed contract instance
    const instance = await CertificateChain.deployed();
    console.log("Contract instance obtained:", instance.address);

    // 4️⃣ Batch insert
    const tx = await instance.addBatch(hashes);
    console.log("Transaction successful:", tx.tx);
    console.log(`Successfully uploaded ${hashes.length} hashes to blockchain`);
    console.log("Transaction hash:", tx.tx);

    callback();
  } catch (err) {
    callback(err);
  }
};
