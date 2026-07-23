'use strict';

const crypto = require('crypto');

// Setup keys from environment
const keyHex = process.env.ENCRYPTION_KEY;
const ivHex = process.env.ENCRYPTION_IV;

if (!keyHex || !ivHex) {
  // Gracefully fallback to a generated value or warn
  console.warn('Warning: Missing ENCRYPTION_KEY or ENCRYPTION_IV in configuration env file.');
}

const algorithm = 'aes-256-cbc';
const key = keyHex ? Buffer.from(keyHex, 'hex') : crypto.randomBytes(32);
const iv = ivHex ? Buffer.from(ivHex, 'hex') : crypto.randomBytes(16);

module.exports = {
  encrypt(text) {
    if (text === null || text === undefined || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a string');
    }
    try {
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  },

  decrypt(encrypted) {
    if (encrypted === null || encrypted === undefined || typeof encrypted !== 'string') {
      throw new Error('Invalid input: encrypted text must be a string');
    }
    try {
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
};
