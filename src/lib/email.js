'use strict';
const nodemailer = require('nodemailer');

// Crea un transporter reutilizable usando variables de entorno
function createTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const transporter = createTransport();

/**
 * Envía email de resultado a un usuario
 * @param {Object} opts
 * @param {string} opts.to           - email destino
 * @param {string} opts.displayName  - nombre del usuario
 * @param {Object} opts.match        - partido {teamAName, teamBName, resultA, resultB}
 * @param {Object} opts.pred         - predicción {scoreA, scoreB, pointsTotal}
 */
async function sendResultEmail({ to, displayName, match, pred }) {
  if (!transporter) return; // sin SMTP configurado, no enviamos

  const won   = pred.pointsTotal > 0;
  const exact = pred.scoreA === match.resultA && pred.scoreB === match.resultB;
  const emoji = exact ? '🎯' : won ? '✅' : '❌';

  const subject = `${emoji} Resultado: ${match.teamAName} ${match.resultA}-${match.resultB} ${match.teamBName} — Prode 2026`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:Inter,Arial,sans-serif;background:#f0f4f8;margin:0;padding:20px}
  .card{background:#fff;border-radius:16px;max-width:520px;margin:0 auto;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.1)}
  .header{text-align:center;margin-bottom:24px}
  .trophy{font-size:2.5rem;display:block;margin-bottom:8px}
  h2{color:#1a2b52;font-size:1.2rem;margin:0}
  .score-row{display:flex;align-items:center;justify-content:center;gap:16px;margin:20px 0;background:#f8fafc;border-radius:12px;padding:20px}
  .team{text-align:center;flex:1}
  .team-name{font-size:.85rem;color:#64748b;font-weight:600}
  .team-score{font-size:3rem;font-weight:800;color:#1a2b52;line-height:1}
  .vs{font-size:.75rem;color:#94a3b8;font-weight:700}
  .pred-row{background:#dbeafe;border-radius:8px;padding:12px 16px;text-align:center;margin:12px 0}
  .pred-label{font-size:.8rem;color:#1d4ed8;font-weight:600;margin-bottom:4px}
  .pred-score{font-size:1.4rem;font-weight:800;color:#1e40af}
  .points-badge{display:inline-block;padding:8px 20px;border-radius:20px;font-size:1.1rem;font-weight:800;margin:16px 0}
  .points-pos{background:#dcfce7;color:#15803d}
  .points-zero{background:#f1f5f9;color:#64748b}
  .exact{background:#fef9c3;color:#854d0e}
  .footer{text-align:center;font-size:.78rem;color:#94a3b8;margin-top:20px}
  .btn{display:inline-block;background:#1a2b52;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:8px}
</style></head>
<body>
<div class="card">
  <div class="header">
    <span class="trophy">🏆</span>
    <h2>PRODE MUNDIAL 2026</h2>
    <p style="color:#64748b;margin:.5rem 0 0">Hola <strong>${displayName}</strong>, ya hay resultado!</p>
  </div>

  <div class="score-row">
    <div class="team">
      <div class="team-name">${match.teamAName}</div>
      <div class="team-score">${match.resultA}</div>
    </div>
    <div class="vs">VS</div>
    <div class="team">
      <div class="team-score">${match.resultB}</div>
      <div class="team-name">${match.teamBName}</div>
    </div>
  </div>

  <div class="pred-row">
    <div class="pred-label">Tu pronóstico</div>
    <div class="pred-score">${pred.scoreA} — ${pred.scoreB}</div>
  </div>

  <div style="text-align:center">
    <span class="points-badge ${exact ? 'exact' : pred.pointsTotal > 0 ? 'points-pos' : 'points-zero'}">
      ${exact ? '🎯 ¡Resultado exacto!' : pred.pointsTotal > 0 ? `+${pred.pointsTotal} puntos` : 'Sin puntos esta vez'}
    </span>
    ${exact ? '<br><small style="color:#854d0e">¡Adivinaste el marcador exacto!</small>' : ''}
  </div>

  <div style="text-align:center;margin-top:16px">
    <a href="${process.env.APP_URL || 'https://prode.muchacholoco.com.ar'}" class="btn">Ver ranking →</a>
  </div>
  <div class="footer">Prode Mundial 2026 · <a href="${process.env.APP_URL || 'https://prode.muchacholoco.com.ar'}" style="color:#94a3b8">prode.muchacholoco.com.ar</a></div>
</div>
</body></html>`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Prode 2026" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

/**
 * Envía emails en bulk para todos los predictores de un partido
 */
async function sendResultBulk({ match, predictions, users }) {
  if (!transporter) return { sent: 0, skipped: 'SMTP no configurado' };
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  let sent = 0;
  for (const pred of predictions) {
    const user = userMap[pred.userId];
    if (!user?.email) continue;
    try {
      await sendResultEmail({ to: user.email, displayName: user.displayName, match, pred });
      sent++;
    } catch (e) {
      console.error(`Email fail for ${user.email}:`, e.message);
    }
  }
  return { sent };
}

module.exports = { sendResultEmail, sendResultBulk };
