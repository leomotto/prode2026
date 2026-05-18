/**
 * alerts.js — Sistema de alertas de partidos próximos sin pronóstico
 * Incluir en cualquier página autenticada junto con api.js
 * Usa la Notifications API del browser si tiene permiso
 */
(function ProdeAlerts() {
  if (!Auth.isLogged()) return;

  async function checkPending() {
    try {
      const pending = await api.predictions.pending();
      if (!pending.length) return;

      pending.forEach(match => {
        const msUntil = new Date(match.date) - Date.now();
        const minUntil = Math.floor(msUntil / 60000);
        const label = `${match.teamAFlag}${match.teamAName} vs ${match.teamBName}${match.teamBFlag}`;

        // Toast siempre
        Toast.warn(
          '⚠️ Partido sin pronóstico',
          `${label} empieza en ${minUntil < 60 ? minUntil + ' min' : Math.floor(minUntil/60) + 'h'}. <a href="/matches.html" style="color:var(--c-gold)">Pronosticar →</a>`,
          10000
        );

        // Browser Notification si hay permiso
        if (Notification.permission === 'granted') {
          new Notification('⚠️ Prode Mundial 2026', {
            body: `${label} empieza en ${minUntil} min y no hiciste tu pronóstico.`,
            icon: '/favicon.ico',
            tag: match.id,
          });
        }
      });
    } catch { /* silencioso */ }
  }

  // Pedir permiso de notificaciones
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  // Chequear al cargar y cada 5 minutos
  checkPending();
  setInterval(checkPending, 5 * 60 * 1000);
})();
