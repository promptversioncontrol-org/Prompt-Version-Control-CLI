import os from "os";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import path from "path";

interface Session {
  userId: string;
  sessionToken: string;
}

export async function loginSSHCommand(cwd: string, backendUrl: string) {
  console.log("🔐 Starting SSH login...");

  // 1. Locate SSH public & private keys
  const { pubkey, privateKeyPath } = findSSHKeys();
  console.log("🗝️ Using public key:", pubkey.split(" ")[0]);

  // 2. Send pubkey → receive challenge
  const challenge = await requestChallenge(pubkey, backendUrl);
  console.log("📨 Received challenge from server");

  // 3. Sign challenge
  const signature = signChallenge(challenge, privateKeyPath);
  console.log("✍️ Challenge signed");

  // 4. Verify signature → get session
  const session = await verifySignature(pubkey, signature, challenge, backendUrl);

  // Update config.json with userId
  persistUserId(cwd, session.userId);

  console.log("✅ Logged in as user:", session.userId);
  console.log("✅ Session token:", session.sessionToken);

  // 5. Save session token in project folder
  saveSessionToken(cwd, session.sessionToken);

  console.log("🎉 Session saved! You are logged in.");

  return session;
}

/* ----------------------------------------------------
 *  Step 1 - Find SSH keys
 * ---------------------------------------------------- */
function findSSHKeys() {
  const home = os.homedir();
  const sshDir = path.join(home, ".ssh");

  const candidates = [
    { pub: "id_ed25519.pub", priv: "id_ed25519" },
    { pub: "id_rsa.pub", priv: "id_rsa" },
    { pub: "id_ecdsa.pub", priv: "id_ecdsa" }
  ];

  for (const c of candidates) {
    const pubPath = path.join(sshDir, c.pub);
    const privPath = path.join(sshDir, c.priv);

    if (existsSync(pubPath) && existsSync(privPath)) {
      return {
        pubkey: readFileSync(pubPath, "utf8").trim(),
        privateKeyPath: privPath
      };
    }
  }

  throw new Error("❌ No SSH keys found in ~/.ssh/. Generate one with: ssh-keygen -t ed25519");
}

/* ----------------------------------------------------
 *  Step 2 - Request challenge (backend expects "pubkey")
 * ---------------------------------------------------- */
async function requestChallenge(pubkey: string, backendUrl: string) {
  const res = await fetch(`${backendUrl}/api/auth/ssh/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pubkey })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("❌ Challenge request failed: " + data.error);

  return data.challenge;
}

/* ----------------------------------------------------
 *  Step 3 - Sign challenge (ssh-keygen -Y sign)
 * ---------------------------------------------------- */
function signChallenge(challenge: string, privateKeyPath: string) {
  const challengeFile = path.join(os.tmpdir(), `pvc_challenge_${Date.now()}.txt`);
  writeFileSync(challengeFile, challenge);

  const cmd = `ssh-keygen -Y sign -f "${privateKeyPath}" -n pvc "${challengeFile}"`;
  execSync(cmd);

  const sig = readFileSync(`${challengeFile}.sig`);
  return sig.toString("base64");
}

/* ----------------------------------------------------
 *  Step 4 - Verify signature (backend expects:
 *       - publicKey
 *       - signature
 *       - challenge
 * ---------------------------------------------------- */
async function verifySignature(publicKey: string, signature: string, challenge: string, backendUrl: string): Promise<Session> {
  const res = await fetch(`${backendUrl}/api/auth/ssh/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey,
      signature,
      challenge
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error("❌ Signature verification failed: " + data.error);

  return data;
}

/* ----------------------------------------------------
 *  Step 5 - Save session token locally
 * ---------------------------------------------------- */
function saveSessionToken(cwd: string, token: string) {
  const pvcDir = path.join(cwd, ".pvc");
  const configPath = path.join(pvcDir, "config.json");

  if (!existsSync(pvcDir)) mkdirSync(pvcDir);

  let config: any = {};
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  }

  config = { ...config, sessionToken: token };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function persistUserId(cwd: string, userId: string) {
  const pvcDir = path.join(cwd, ".pvc");
  const configPath = path.join(pvcDir, "config.json");

  if (!existsSync(pvcDir)) {
    mkdirSync(pvcDir, { recursive: true });
  }

  let config: any = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      config = {};
    }
  }

  config = { ...config, userId };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
