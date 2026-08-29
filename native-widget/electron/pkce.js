const crypto = require('node:crypto');

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier() {
  return base64url(crypto.randomBytes(64));
}

function codeChallengeFromVerifier(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

module.exports = { generateCodeVerifier, codeChallengeFromVerifier, base64url };
