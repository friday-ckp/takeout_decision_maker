#!/usr/bin/env bash
# ============================================================
# 外卖点餐决策器 — K8s 一键部署脚本
# 使用方法：chmod +x deploy.sh && ./deploy.sh
# ============================================================
set -euo pipefail

REGISTRY="crpi-dgkl9khr1943eg60.cn-hangzhou.personal.cr.aliyuncs.com"
REPO="hq-service/takeout_decision_maker"
TAG="1.0.0"
NS="takeout"

# ---- 敏感配置（从 Nacos 同步而来，勿提交到 git）----
MYSQL_ROOT_PASSWORD="b9da064ed825006e28f4279b73db05af"
MYSQL_PASSWORD="5ffd671dd410858b6c9a0018e98354c2"
SESSION_SECRET="RFMZKqnAhxMLYmHQvTjiNTI8tGHMgilV8+eIcBYx5JA="

# ============================================================
# Step 1: 登录镜像仓库并 build/push
# ============================================================
echo ">>> [1/5] 登录阿里云镜像仓库..."
docker login "${REGISTRY}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo ">>> [2/5] 构建并推送 backend 镜像..."
docker build -t "${REGISTRY}/${REPO}:backend-${TAG}" "${PROJECT_ROOT}/backend"
docker push "${REGISTRY}/${REPO}:backend-${TAG}"

echo ">>> [3/5] 构建并推送 frontend 镜像..."
docker build -t "${REGISTRY}/${REPO}:frontend-${TAG}" "${PROJECT_ROOT}/frontend"
docker push "${REGISTRY}/${REPO}:frontend-${TAG}"

# ============================================================
# Step 2: 创建 Namespace + RBAC
# ============================================================
echo ">>> [4/5] 部署 Namespace 和 RBAC..."
kubectl apply -f "${SCRIPT_DIR}/00-namespace.yaml"
kubectl apply -f "${SCRIPT_DIR}/05-rbac-network.yaml"

# ============================================================
# Step 3: 注入 Secret（从变量读取，不写入 yaml）
# ============================================================
echo ">>> 注入 mysql-secret..."
kubectl create secret generic mysql-secret \
  --namespace="${NS}" \
  --from-literal=MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD}" \
  --from-literal=MYSQL_PASSWORD="${MYSQL_PASSWORD}" \
  --from-literal=MYSQL_USER="takeout_user" \
  --from-literal=MYSQL_DATABASE="takeout_decision" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ">>> 注入 backend-secret..."
kubectl create secret generic backend-secret \
  --namespace="${NS}" \
  --from-literal=DB_HOST="mysql.${NS}.svc.cluster.local" \
  --from-literal=DB_PORT="3306" \
  --from-literal=DB_USER="takeout_user" \
  --from-literal=DB_PASSWORD="${MYSQL_PASSWORD}" \
  --from-literal=DB_NAME="takeout_decision" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=NODE_ENV="production" \
  --from-literal=PORT="3000" \
  --from-literal=SESSION_EXPIRE_HOURS="24" \
  --from-literal=APP_BASE_URL="https://takeout.test.huaqing.run" \
  --dry-run=client -o yaml | kubectl apply -f -

# ============================================================
# Step 4: 部署 MySQL、Backend、Frontend、Ingress
# ============================================================
echo ">>> [5/5] 部署应用..."
kubectl apply -f "${SCRIPT_DIR}/01-mysql-statefulset.yaml"

echo ">>> 等待 MySQL 就绪（最长 120s）..."
kubectl rollout status statefulset/mysql -n "${NS}" --timeout=120s

kubectl apply -f "${SCRIPT_DIR}/02-backend.yaml"
kubectl apply -f "${SCRIPT_DIR}/03-frontend.yaml"
kubectl apply -f "${SCRIPT_DIR}/04-ingress.yaml"

echo ">>> 等待 backend 就绪..."
kubectl rollout status deployment/backend -n "${NS}" --timeout=120s

echo ">>> 等待 frontend 就绪..."
kubectl rollout status deployment/frontend -n "${NS}" --timeout=120s

# ============================================================
# 验证
# ============================================================
echo ""
echo "============================================================"
echo "✅ 部署完成！"
echo "------------------------------------------------------------"
kubectl get pods -n "${NS}"
echo ""
echo "访问地址：http://takeout.test.huaqing.run"
echo "健康检查：curl http://takeout.test.huaqing.run/health"
echo "============================================================"
