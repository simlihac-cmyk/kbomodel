import process from "node:process";

import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error("Usage: node scripts/hash-admin-password.mjs <password>");
  process.exit(1);
}

const salt = randomBytes(16);
const key = scryptSync(password, salt, 64);
console.log(`scrypt:${salt.toString("base64")}:${key.toString("base64")}`);
