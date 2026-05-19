#!/bin/bash
set -e

if [ -n "$GH_PAT" ]; then
  echo "🔗 Actualizando credenciales git..."
  git remote set-url origin https://leomotto:${GH_PAT}@github.com/leomotto/prode2026.git
fi

echo "🧹 Limpiando cambios locales en el servidor..."
git config core.autocrlf input
git reset --hard HEAD

echo "📥 Descargando últimos cambios..."
git fetch origin main
git reset --hard origin/main

echo "📦 Instalando dependencias..."
npm ci --omit=dev

echo "⚙️ Generando Prisma client..."
npx prisma generate

echo "🗄️ Actualizando Base de Datos..."
npx prisma db push --accept-data-loss

echo "🔄 Reiniciando servidor (Phusion Passenger)..."
mkdir -p tmp
touch tmp/restart.txt

if command -v pm2 &> /dev/null; then
  echo "🔄 Reiniciando procesos con PM2..."
  pm2 restart all || true
fi

echo "✅ Deploy completado exitosamente!"
