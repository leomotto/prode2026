FROM node:24-alpine
# Prisma 5 en musl necesita libssl para su query engine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force
COPY src ./src
COPY public ./public
ENV NODE_ENV=production IP=0.0.0.0 PORT=3000
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
