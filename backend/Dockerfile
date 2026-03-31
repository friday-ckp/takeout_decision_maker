FROM crpi-dgkl9khr1943eg60.cn-hangzhou.personal.cr.aliyuncs.com/hq-docker-mirror/node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM crpi-dgkl9khr1943eg60.cn-hangzhou.personal.cr.aliyuncs.com/hq-docker-mirror/node:20-alpine
WORKDIR /app

# 非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY migrations ./migrations
COPY package.json ./

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
