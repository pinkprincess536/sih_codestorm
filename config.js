import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_DIR = __dirname;

export default {
  csvFilePath: path.join(BASE_DIR, 'data', 'certificates.csv'),
  uploadsDir: path.join(BASE_DIR, 'express', 'uploads'),
  verifiedDir: path.join(BASE_DIR, 'express', 'company_data', 'verified'),
  unverifiedDir: path.join(BASE_DIR, 'express', 'company_data', 'unverified'),
  exportScriptPath: path.join(BASE_DIR, 'blockchain', 'scripts', 'exportcert.js')
};
