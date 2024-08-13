// src/mocks/binaryToBase64.js
export default function binaryToBase64(data) {
  // Simple implementation, might need to be adjusted based on your needs
  return Buffer.from(data).toString('base64');
}
