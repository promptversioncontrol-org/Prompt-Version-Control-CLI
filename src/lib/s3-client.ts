// lib/s3-client.ts
import { S3Client } from '@aws-sdk/client-s3';
import { ENV } from '../config/env.js';

const credentials =
  ENV.AWS_ACCESS_KEY_ID && ENV.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: ENV.AWS_ACCESS_KEY_ID,
        secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

export const s3Client = new S3Client({
  region: ENV.AWS_REGION || 'eu-north-1',
  credentials,
});
