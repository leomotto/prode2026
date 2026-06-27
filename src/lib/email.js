'use strict';

const nodemailer = require('nodemailer');
const config     = require('../config');

// Si las vars SMTP no están configuradas, todos los envíos son no-op silencioso.
function isConfigured() {
  return !!(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);
}

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   config.SMTP_HOST,
      port:   config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    });
  }
  return _transporter;
}

function pointsLabel(pts) {
  if (pts === 3) return '🎯 ¡Resultado exacto! <strong>+3 pts</strong>';
  if (pts === 1) return '✅ Resultado correcto <strong>+1 pt</strong>';
  return '❌ Sin puntos esta vez';
}

function buildHtml({ displayName, match, prediction, appUrl }) {
  const { teamAFlag = '', teamAName, teamBFlag = '', teamBName, resultA, resultB } = match;
  const { scoreA, scoreB, pointsTotal } = prediction;
  const pts = pointsTotal ?? 0;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a6e,#2563eb);padding:24px;text-align:center">
      <div style="font-size:28px">🏆</div>
      <div style="color:#fff;font-size:18px;font-weight:700;margin-top:4px">Prode Mundial 2026</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 24px">
      <p style="margin:0 0 16px;color:#374151">Hola <strong>${displayName}</strong>,</p>
      <p style="margin:0 0 20px;color:#374151">Ya tenemos el resultado:</p>

      <!-- Resultado -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Resultado final</div>
        <div style="font-size:26px;font-weight:700;color:#1e293b">
          ${teamAFlag} ${teamAName} <span style="color:#64748b">${resultA} – ${resultB}</span> ${teamBName} ${teamBFlag}
        </div>
      </div>

      <!-- Pronóstico -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Tu pronóstico</div>
        <div style="font-size:22px;font-weight:600;color:#1e293b">${scoreA} – ${scoreB}</div>
      </div>

      <!-- Puntos -->
      <div style="background:${pts === 3 ? '#fef9c3' : pts === 1 ? '#d1fae5' : '#f1f5f9'};border-radius:8px;padding:16px;text-align:center;margin-bottom:24px">
        <div style="font-size:16px;color:#1e293b">${pointsLabel(pts)}</div>
      </div>

      <div style="text-align:center">
        <a href="${appUrl}/rankings" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Ver ranking →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
      <p style="margin:0;font-size:12px;color:#94a3b8">Prode Mundial 2026 · Responder a este mail no tiene efecto</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Envía emails de resultado a todos los usuarios con predicción en el partido.
 * @param {{ match, predictions: Array, users: Array }} opts
 */
async function sendResultBulk({ match, predictions, users }) {
  if (!isConfigured()) return { sent: 0, skipped: 'SMTP no configurado' };

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const transport = getTransporter();
  const appUrl = config.APP_URL;

  let sent = 0;
  const errors = [];

  for (const pred of predictions) {
    const user = userMap[pred.userId];
    if (!user?.email) continue;

    const subject = `${match.teamAName} ${match.resultA}–${match.resultB} ${match.teamBName} · Tu resultado`;
    const html = buildHtml({ displayName: user.displayName, match, prediction: pred, appUrl });

    try {
      await transport.sendMail({ from: config.SMTP_FROM, to: user.email, subject, html });
      sent++;
    } catch (e) {
      errors.push(`${user.email}: ${e.message}`);
    }
  }

  return { sent, errors };
}

// Alias para envío individual (firma compatible con llamadas futuras)
async function sendResultEmail({ match, prediction, user }) {
  return sendResultBulk({ match, predictions: [prediction], users: [user] });
}

module.exports = { sendResultEmail, sendResultBulk };
