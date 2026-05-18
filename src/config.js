'use strict';
require('dotenv').config();

const required = [
  'DATABASE_URL', 'JWT_SECRET',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL',
  'TURNSTILE_SECRET_KEY', 'APP_URL'
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Variable de entorno faltante: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  NODE_ENV:               process.env.NODE_ENV || 'development',
  PORT:                   parseInt(process.env.PORT) || 3000,
  IP:                     process.env.IP || '127.0.0.1',
  DATABASE_URL:           process.env.DATABASE_URL,
  JWT_SECRET:             process.env.JWT_SECRET,
  JWT_EXPIRY:             '7d',
  GOOGLE_CLIENT_ID:       process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET:   process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL:    process.env.GOOGLE_CALLBACK_URL,
  TURNSTILE_SECRET_KEY:   process.env.TURNSTILE_SECRET_KEY,
  TURNSTILE_SITE_KEY:     process.env.TURNSTILE_SITE_KEY || '',
  APP_URL:                process.env.APP_URL,
  ADMIN_SETUP_KEY:        process.env.ADMIN_SETUP_KEY || '',
};
