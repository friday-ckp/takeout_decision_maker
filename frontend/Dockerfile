FROM crpi-dgkl9khr1943eg60.cn-hangzhou.personal.cr.aliyuncs.com/hq-docker-mirror/nginx:1.27-alpine

# 非 root 用户运行（nginx 默认 pid 需要权限调整）
RUN sed -i 's|user  nginx;||g' /etc/nginx/nginx.conf && \
    sed -i 's|/var/run/nginx.pid|/tmp/nginx.pid|g' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx && \
    chmod -R 755 /var/cache/nginx /var/log/nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY pages ./pages
COPY scripts ./scripts
COPY styles ./styles

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1
