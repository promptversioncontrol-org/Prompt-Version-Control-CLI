import crypto from 'crypto';
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';

function getFingerprint(pubKey: string) {
  const parts = pubKey.split(' ');
  if (parts.length < 2) return 'Invalid key format';

  const base64Key = parts[1];
  const buffer = Buffer.from(base64Key, 'base64');
  const hash = crypto.createHash('sha256').update(buffer).digest('base64');
  return hash; // This matches the "CLI fingerprint" in the logs
}

function checkKeys() {
  const home = os.homedir();
  const sshDir = path.join(home, '.ssh');
  const pubPath = path.join(sshDir, 'id_ed25519.pub');

  try {
    const pubKey = readFileSync(pubPath, 'utf8').trim();
    console.log('Public Key:', pubKey);
    console.log('Calculated Fingerprint (SHA256):', getFingerprint(pubKey));

    // Check what the DB has (based on logs)
    const dbFingerprint = 'c3NoLWVkMjU1MTkgQUFBQUMzTnphQzFs';
    const dbDecoded = Buffer.from(dbFingerprint, 'base64').toString();
    console.log('DB Fingerprint (Decoded):', dbDecoded);
  } catch (err) {
    console.error('Error reading key:', err);
  }
}

checkKeys();
