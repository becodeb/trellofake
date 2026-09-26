FROM node:22-alpine AS builder
RUN apk add --no-cache openssl && apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl && apk add --no-cache libc6-compat
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/extension ./extension
COPY --from=builder /app/public ./public
RUN npx prisma generate && mkdir -p /app/data /app/storage
COPY docker-entrypoint.sh /usr/local/bin/hilo-entrypoint
RUN chmod +x /usr/local/bin/hilo-entrypoint
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/hilo-entrypoint"]
CMD ["npx", "next", "start", "-H", "0.0.0.0"]