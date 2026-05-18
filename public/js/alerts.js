/**
 * alerts.js — Notificaciones de partidos próximos
 * Solo notifica partidos que el usuario activó con el 🔔
 * Si no activó ninguno, avisa de todos los próximos sin pronóstico
 */
(function ProdeAlerts() {
  if (!Auth.isLogged()) return;

  async function checkPending() {
    try {
      const pending = await api.predictions.pending();
      if (!pending.length) return;

      const enabledIds = Notify.allEnabled();

      // Filtrar: si tiene alertas personalizadas, solo esos; si no, todos
      const toAlert = enabledIds.length > 0
        ? pending.filter(m => enabledIds.includes(m.id))
        : pending;

      toAlert.forEach(match => {
        const msUntil = new Date(match.date) - Date.now();
        const minUntil = Math.floor(msUntil / 60000);
        if (msUntil < 0) return; // ya empezó

        const label = `${match.teamAFlag} ${match.teamAName} vs ${match.teamBName} ${match.teamBFlag}`;
        const timeStr = minUntil < 60 ? `${minUntil} min` : `${Math.floor(minUntil/60)}h`;

        Toast.warn(
          '⚠️ Sin pronóstico',
          `${label} empieza en ${timeStr}. <a href="/matches" style="color:var(--c-gold);font-weight:700">Pronosticar →</a>`,
          0 // no auto-cerrar
        );

        if (Notification.permission === 'granted') {
          new Notification('⚠️ Prode Mundial 2026', {
            body: `${match.teamAName} vs ${match.teamBName} empieza en ${timeStr} — ¡sin pronóstico!`,
            icon: '/favicon.ico',
            tag: `prode-${match.id}`,
          });
        }
      });
    } catch { /* silencioso */ }
  }

  // Pedir permiso de notificaciones del navegador
  if (Notification.permission === 'default') {
    // No pedimos automáticamente — lo hacemos cuando activan el bell
  }

  // Chequear al cargar + cada 5 minutos
  checkPending();
  setInterval(checkPending, 5 * 60 * 1000);
})();
