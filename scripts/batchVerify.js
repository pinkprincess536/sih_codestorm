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
    const requiredColumns = ["Name", "University", "Roll Number", "Certificate ID", "Degree Name", "Grade"];
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

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const candidateHash = crypto
        .createHash("sha256")
        .update(stableStringify(record))
        .digest("hex");

      try {
        const blockchainResult = await instance.verifyCertificate(candidateHash);
        const certificateResult = {
          index: i + 1,
          name: record["Name"],
          university: record["University"],
          rollNumber: record["Roll Number"],
          certificateId: record["Certificate ID"],
          degree: record["Degree Name"],
          grade: record["Grade"],
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
            if (reportType === "detailed") {
              console.log(`✅ ${progress} VALID - ${record["Name"]} (${record["University"]})`);
              console.log(`   🎓 ${record["Degree Name"]} | Grade: ${record["Grade"]}`);
              console.log(`   ⏰ Uploaded: ${new Date(parseInt(blockchainResult[1]) * 1000).toLocaleString()}`);
              console.log(`   👤 Issuer: ${blockchainResult[2]}`);
              console.log(`   🔐 Hash: ${candidateHash}`);
            } else {
              console.log(`✅ ${progress} ${record["Name"]} (${record["University"]}) - VALID`);
            }
          } else {
            invalidCount++;
            if (reportType === "detailed") {
              console.log(`❌ ${progress} INVALID - ${record["Name"]} (${record["University"]})`);
              console.log(`   🎓 ${record["Degree Name"]} | Grade: ${record["Grade"]}`);
              console.log(`   🔐 Hash: ${candidateHash}`);
            } else {
              console.log(`❌ ${progress} ${record["Name"]} (${record["University"]}) - NOT FOUND`);
            }
          }

          if (reportType === "detailed") {
            console.log("-".repeat(50));
          }
        }
      } catch (verifyError) {
        console.error(`❌ Error verifying ${record["Name"]}: ${verifyError.message}`);
        invalidCount++;
      }
    }

    const endTime = Date.now();
    const totalTime = ((endTime - startTime) / 1000).toFixed(2);

    const reportData = {
      metadata: {
        csvFile: csvFile,
        totalProcessed: records.length,
        validCount: validCount,
        invalidCount: invalidCount,
        successRate: parseFloat(((validCount / records.length) * 100).toFixed(2)),
        verificationDate: new Date().toISOString(),
        contractAddress: instance.address,
        processingTime: `${totalTime} seconds`,
        averageTimePerCert: `${(totalTime / records.length).toFixed(3)} seconds`
      },
      certificates: results
    };

    if (reportType !== "json-only") {
      console.log("\n" + "=".repeat(60));
      console.log("📊 VERIFICATION SUMMARY");
      console.log("=".repeat(60));
      console.log(`📁 File: ${path.basename(csvFile)}`);
      console.log(`📋 Total Processed: ${records.length}`);
      console.log(`✅ Valid: ${validCount} (${reportData.metadata.successRate}%)`);
      console.log(`❌ Invalid: ${invalidCount} (${(100 - reportData.metadata.successRate).toFixed(2)}%)`);
      console.log(`⏱️  Processing Time: ${totalTime} seconds`);
      console.log(`⚡ Average: ${reportData.metadata.averageTimePerCert}/certificate`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const reportFileName = `verification_report_${timestamp}.json`;
    fs.writeFileSync(reportFileName, JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Detailed report saved: ${reportFileName}`);

    if (reportType === "detailed") {
      const csvSummary = [
        "Name,University,Roll Number,Certificate ID,Degree Name,Grade,Status,Hash,Timestamp,Issuer"
      ];

      results.forEach(r => {
        csvSummary.push([
          r.name,
          r.university,
          r.rollNumber,
          r.certificateId,
          r.degree,
          r.grade,
          r.isValid ? "VALID" : "INVALID",
          r.hash,
          r.timestamp || "N/A",
          r.issuer || "N/A"
        ].map(field => `"${field}"`).join(","));
      });

      const csvReportFile = `verification_summary_${timestamp}.csv`;
      fs.writeFileSync(csvReportFile, csvSummary.join("\n"));
      console.log(`📊 CSV summary saved: ${csvReportFile}`);
    }

    callback();
  } catch (err) {
    console.error("\n❌ VERIFICATION FAILED:");
    console.error(err.message);
    callback(err);
  }
};
