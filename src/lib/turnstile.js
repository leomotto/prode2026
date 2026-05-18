'use strict';
const config = require('../config');

/**
 * Valida un token de Cloudflare Turnstile server-side.
 * @param {string} token - cf-turnstile-response del frontend
 * @param {string} ip    - IP del cliente
 * @returns {Promise<boolean>}
 */
async function verifyTurnstile(token, ip) {
  if (!token) return false;
  const body = new URLSearchParams({
    secret: config.TURNSTILE_SECRET_KEY,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  });
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

module.exports = { verifyTurnstile };
