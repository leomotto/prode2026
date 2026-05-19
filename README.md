<div align="center">
  <img src="https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f3c6.svg" alt="Prode Mundial 2026 Logo" width="100" height="100">
  <h1>Prode Mundial 2026 🏆</h1>
  <p><strong>Plataforma integral, social y competitiva de pronósticos deportivos para el Mundial FIFA 2026</strong></p>
  
  [![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
  [![Fastify](https://img.shields.io/badge/Fastify-4.x-black.svg?style=flat-square&logo=fastify)](https://fastify.io/)
  [![Prisma](https://img.shields.io/badge/Prisma-ORM-blue.svg?style=flat-square&logo=prisma)](https://prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-336791.svg?style=flat-square&logo=postgresql)](https://postgresql.org/)
</div>

---

## 🌟 El Potencial de la Plataforma

**Prode Mundial 2026** no es solo un gestor de predicciones. Es una aplicación social gamificada diseñada a nivel empresarial para escalar a miles de usuarios, permitiendo que la fiebre del mundial se viva entre amigos, oficinas y comunidades en todo el mundo.

### ✨ Características Principales
* **🔥 Autenticación Segura y Sin Fricción:** Integración nativa con Google OAuth2 y verificación de humanos con Cloudflare Turnstile para evitar bots.
* **🌐 Grupos Privados Dinámicos:** Los usuarios pueden crear grupos cerrados con códigos únicos. El "Dueño" o "Encargado" puede definir y editar los **Premios Reales** que recibirá el podio (ej. "Cena paga", "1er premio $50.000").
* **💬 Chat en Tiempo Real:** Chat social integrado en cada grupo privado donde los usuarios interactúan usando un sistema de burbujas en vivo estilo WhatsApp.
* **🛡️ Panel Administrativo Robusto:** Un panel "God Mode" para la gestión de todo el ecosistema (control de usuarios, manejo total de grupos, actualización de resultados en vivo de los 104 partidos y gestión de roles).
* **🤖 Resultados Automatizados:** Preparado para sincronizar los marcadores de la FIFA en tiempo real de manera automática.
* **📱 Diseño Mobile-First & Dark Mode:** Una UI/UX exquisita usando CSS nativo y componentes de cristal, con adaptación instantánea a múltiples dispositivos y soportes claros/oscuros.
* **🆘 Soporte Integrado:** Sistema interno de tickets para que los usuarios levanten consultas directamente hacia los administradores.

---

## 🏗️ Stack Tecnológico Premium

La arquitectura fue construida apostando por la máxima velocidad y seguridad:

- **Backend / API**: Node.js v22 con **Fastify** (el framework web más rápido del ecosistema Node).
- **Base de Datos**: PostgreSQL + **Prisma ORM** (Tipado seguro y migraciones determinísticas).
- **Seguridad Perimetral**: Helmet.js (CSP estricto), protección CORS rigurosa, Limitadores de tasa (Rate Limiting) y encriptación de claves por bcrypt.
- **Frontend Agnostic**: HTML5, Vanilla JavaScript y CSS moderno. Cero frameworks pesados de frontend para garantizar una carga sub-milisegundo.

---

## 🚀 Despliegue Automatizado (CI/CD)

El proyecto cuenta con un flujo CI/CD configurado a través de **GitHub Actions**. Al pushear a la rama `main`, la plataforma de AlwaysData se actualizará, ejecutará Prisma y reiniciará el nodo, todo de manera automatizada:

1. Modifica tus variables de entorno en GitHub Repository **Settings > Secrets and variables > Actions**.
2. Asegúrate de configurar los secretos (`ALWAYSDATA_SSH_HOST`, `ALWAYSDATA_SSH_USER`, `ALWAYSDATA_SSH_KEY`, y `GH_PAT`).
3. Haz push a `main`:
   ```bash
   git add .
   git commit -m "feat: new feature"
   git push origin main
   ```
4. El Action iniciará sesión por SSH y ejecutará `./deploy.sh` descargando la versión más reciente en AlwaysData sin tiempos de inactividad (Zero Downtime con Passenger restart).

---

## 📊 Reglas y Puntos

La competencia es feroz. El modelo de puntuación base es:
* **Marcador exacto:** 10 puntos 🎯
* **Ganador y diferencia de goles:** 7 puntos
* **Ganador y goles de un equipo:** 5 puntos
* **Ganador correcto:** 3 puntos
* **Fallo total:** 0 puntos

---

## 🛠️ Comandos de Desarrollo Locales

```bash
# Instalar dependencias
npm install

# Levantar entorno de desarrollo (con recarga automática)
npm run dev

# Sincronizar la Base de Datos localmente
npx prisma db push

# Popular la base con el Fixture de 104 partidos
node prisma/seed.js

# Ver la base de datos visualmente
npx prisma studio
```

---

<div align="center">
  <i>Construido con dedicación para el Mundial FIFA 2026. ¡A jugar!</i>
</div>
