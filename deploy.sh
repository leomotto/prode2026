#!/bin/bash

if [ -n "$GH_PAT" ]; then
  echo "🔗 Actualizando credenciales git..."
  git remote set-url origin https://leomotto:${GH_PAT}@github.com/leomotto/prode2026.git
fi

echo "📥 Descargando últimos cambios..."
git pull origin main

echo "📦 Instalando dependencias..."
npm ci --omit=dev

echo "⚙️ Generando Prisma client..."
npx prisma generate

echo "🗄️ Actualizando Base de Datos..."
npx prisma db push --accept-data-loss

echo "🔄 Reiniciando servidor (AlwaysData Passenger)..."
mkdir -p tmp
touch tmp/restart.txt

echo "✅ Deploy completado exitosamente!"
