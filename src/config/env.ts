// config/env.ts
import dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Próbuj załadować z różnych lokalizacji
const possiblePaths = [
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../.env'),
];

for (const path of possiblePaths) {
  if (existsSync(path)) {
    console.log(`Loading .env from: ${path}`); // ✅ Fixed
    dotenv.config({ path });
    break;
  }
}

export const getEnvironment = (name: string, required = true) => {
  const environment = process.env[name];

  if (!environment && required) {
    throw new Error(`❌ Missing ${name} environment variable`); // ✅ Fixed
  }

  return environment || '';
};

export const ENV = {
  AWS_ACCESS_KEY_ID: getEnvironment('AWS_ACCESS_KEY_ID', false),
  AWS_SECRET_ACCESS_KEY: getEnvironment('AWS_SECRET_ACCESS_KEY', false),
  AWS_REGION: getEnvironment('AWS_REGION', false) || 'eu-north-1',
  AWS_BUCKET_NAME: getEnvironment('AWS_BUCKET_NAME', false),
  AWS_KMS_KEY_ID: getEnvironment('AWS_KMS_KEY_ID', false),
};
