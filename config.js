// Prototype/config.js
const path = require('path');

// The absolute path to the project's root directory
const BASE_DIR = __dirname;

module.exports = {
  // Data Paths
  csvFilePath: path.join(BASE_DIR, 'data', 'certificates.csv'),
  
  // Express Server Paths
  uploadsDir: path.join(BASE_DIR, 'express', 'uploads'),
  verifiedDir: path.join(BASE_DIR, 'express', 'company_data', 'verified'),
  unverifiedDir: path.join(BASE_DIR, 'express', 'company_data', 'unverified'),

  // Script Paths
  exportScriptPath: path.join(BASE_DIR, 'blockchain', 'scripts', 'exportcert.js')
};