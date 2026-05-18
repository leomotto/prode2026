'use strict';

// Email deshabilitado por el momento — stub no-op
// Cuando se active, descomentar nodemailer y agregar SMTP_* a las vars de entorno

async function sendResultEmail() { /* no-op */ }
async function sendResultBulk()  { return { sent: 0, skipped: 'Email deshabilitado' }; }

module.exports = { sendResultEmail, sendResultBulk };
