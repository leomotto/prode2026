#!/bin/bash
set -e

if [ -n "$GH_PAT" ]; then
  echo "🔗 Actualizando credenciales git..."
  git remote set-url origin https://leomotto:${GH_PAT}@github.com/leomotto/prode2026.git
fi

echo "🧹 Limpiando cambios locales en el servidor..."
git config core.autocrlf input
git reset -q --hard HEAD

echo "📥 Descargando últimos cambios..."
git fetch -q origin main
git reset -q --hard origin/main

echo "📦 Instalando dependencias..."
npm ci --omit=dev

echo "⚙️ Generando Prisma client..."
npx prisma generate

echo "🗄️ Actualizando Base de Datos..."
npx prisma db push --accept-data-loss
node fix-points.js

echo "🏷️ Actualizando versión en footer..."
GIT_HASH=$(git rev-parse --short HEAD)
sed -i "s/const version = 'v[^']*'/const version = 'v${GIT_HASH}'/" public/js/api.js

echo "🔄 Reiniciando servidor (Phusion Passenger)..."
mkdir -p tmp
touch tmp/restart.txt

if command -v pm2 &> /dev/null; then
  echo "🔄 Reiniciando procesos con PM2..."
  pm2 restart all || true
fi

if [ -n "$ALWAYSDATA_API_KEY" ] && [ -n "$ALWAYSDATA_SITE_ID" ]; then
  echo "🔄 Reiniciando sitio vía API de Alwaysdata..."
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -u "${ALWAYSDATA_API_KEY} account=muchacholoco:" \
    "https://api.alwaysdata.com/v1/site/${ALWAYSDATA_SITE_ID}/restart/")
  if [ "$HTTP_STATUS" = "204" ]; then
    echo "✅ Restart via API OK"
  else
    echo "⚠️  API restart respondió HTTP ${HTTP_STATUS} (el restart.txt igual aplica)"
  fi
fi

echo "✅ Deploy completado exitosamente!"
