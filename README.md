# 🏆 Prode Mundial 2026

Plataforma de pronósticos deportivos para el Mundial FIFA 2026. Multi-usuario, con autenticación Google OAuth, Cloudflare Turnstile y base de datos PostgreSQL en Alwaysdata.

## Stack
- **Backend**: Node.js 22 + Fastify 4 + Prisma ORM
- **Base de datos**: PostgreSQL (Alwaysdata)
- **Auth**: JWT + Google OAuth2 + bcrypt
- **Seguridad**: Helmet, Rate Limiting, CORS, Turnstile
- **Frontend**: HTML5 + CSS3 + Vanilla JS

---

## 🚀 Deploy en Alwaysdata

### 1. Crear la base de datos PostgreSQL

En el panel de Alwaysdata → **Databases > PostgreSQL**:
- Crear una base de datos llamada `prode2026`
- Anotar host, usuario y contraseña

### 2. Subir el código

```bash
# Por SSH en tu cuenta Alwaysdata
cd $HOME
git clone <tu-repo> prode2026
cd prode2026
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
nano .env
```

Completar **todas** las variables. Ver `.env.example` para referencia.

Para el DATABASE_URL usar el formato:
```
postgresql://muchacholoco:TU_PASSWORD@postgresql-muchacholoco.alwaysdata.net:5432/prode2026?schema=public
```

### 4. Migrar la base de datos y cargar fixture

```bash
npx prisma migrate deploy
node prisma/seed.js
```

### 5. Crear el primer administrador

```bash
# Una vez registrado en la app con tu email de Google:
curl -X POST https://prode.muchacholoco.com.ar/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@email.com","key":"TU_ADMIN_SETUP_KEY"}'
```

### 6. Configurar el sitio en Alwaysdata

En el panel → **Web > Sites > Agregar**:
- **Tipo**: Node.js
- **Comando**: `node $HOME/prode2026/src/server.js`
- **Directorio de trabajo**: `/home/muchacholoco/prode2026`
- **Versión Node.js**: 22

### 7. Configurar subdominio

En el panel → **Web > Sites**, configurar:
- **Dirección**: `prode.muchacholoco.com.ar`
- Apuntando al sitio Node.js

### 8. Configurar Cloudflare Turnstile

1. Ir a https://dash.cloudflare.com → Turnstile
2. Crear un nuevo widget con dominio `prode.muchacholoco.com.ar`
3. Copiar **Site Key** y **Secret Key** al `.env`
4. Reemplazar `__TURNSTILE_SITE_KEY__` en `public/login.html` con tu Site Key real

### 9. Configurar Google OAuth2

1. Ir a https://console.cloud.google.com → APIs & Services → Credentials
2. Crear un **OAuth 2.0 Client ID** de tipo "Web application"
3. Authorized redirect URIs: `https://prode.muchacholoco.com.ar/api/auth/google/callback`
4. Copiar Client ID y Client Secret al `.env`

---

## 📊 Sistema de Puntos

| Resultado | Puntos |
|-----------|--------|
| Marcador exacto | **10 pts** |
| Ganador + diferencia goles exacta | **7 pts** |
| Ganador + goles de un equipo exactos | **5 pts** |
| Ganador correcto | **3 pts** |
| Fallo total | **0 pts** |

**Bonus:**
- Primer goleador acertado: **+3 pts**
- Tarjetas exactas: **+1 pt**
- Córners exactos: **+1 pt**
- BTTS acertado: **+1 pt**
- MVP acertado: **+2 pts**

---

## 🔐 Seguridad

- Contraseñas hasheadas con bcrypt (12 rounds)
- JWT con expiración de 7 días
- Rate limiting: 5 req/min en endpoints de auth
- Helmet con CSP configurado
- CORS restringido a `APP_URL`
- Turnstile en login/registro
- Predicciones bloqueadas server-side cuando el partido pasa a LIVE
- Variables sensibles solo en `.env` (nunca commiteado)

---

## 🛠️ Comandos útiles

```bash
npm run dev           # Desarrollo con hot reload
npm start             # Producción
npm run db:push       # Sync schema sin migraciones
npm run db:migrate    # Aplicar migraciones
npm run db:seed       # Cargar 104 partidos
npm run db:studio     # Prisma Studio (UI de la DB)
```

---

## 📅 Fixture incluido

- **72 partidos** de fase de grupos (grupos A–L, 12 grupos × 6 partidos)
- **16 partidos** de 1/32 de final
- **8 partidos** de octavos de final
- **4 partidos** de cuartos de final
- **2 semifinales**
- **1 tercer puesto**
- **1 final** (19 jul 2026, MetLife Stadium)

Total: **104 partidos**

🇦🇷 Los 3 partidos de Argentina (Grupo J) están marcados como `featured` y `argentina: true`.
