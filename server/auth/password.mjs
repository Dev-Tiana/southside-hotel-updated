import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
const parameters = { memory: 65536, passes: 3, parallelism: 1, tagLength: 32 };
let active = 0;
async function derive(password, salt) {
  if (typeof argon2 !== 'function') throw new Error('Node 24.7+ with Argon2 support is required');
  if (active >= 4) throw new Error('Password verifier busy');
  active++;
  try {
    return await new Promise((resolve, reject) => argon2('argon2id', { ...parameters, message: password, nonce: salt }, (error, result) => error ? reject(error) : resolve(result)));
  } finally { active--; }
}
export function validPassword(password) {
  return typeof password === 'string' && [...password].length >= 15 && password.length <= 128 && Buffer.byteLength(password, 'utf8') <= 512;
}
export async function hashPassword(password) {
  if (!validPassword(password)) throw new Error('Use a password of 15 to 128 characters');
  const salt = randomBytes(16), hash = await derive(password, salt);
  return `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString('base64').replace(/=+$/g, '')}$${hash.toString('base64').replace(/=+$/g, '')}`;
}
export async function verifyPassword(encoded, password) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 512) return false;
  const match = /^\$argon2id\$v=19\$m=65536,t=3,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(encoded);
  if (!match) return false;
  const actual = await derive(password, Buffer.from(match[1], 'base64'));
  return timingSafeEqual(actual, Buffer.from(match[2], 'base64'));
}
// Unknown accounts still perform the same expensive derivation.
export const dummyHash = '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
