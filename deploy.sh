#!/bin/bash

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
