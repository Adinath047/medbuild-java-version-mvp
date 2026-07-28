#!/usr/bin/env bash
# ===================================================================================
#  MEDBUILD — UTHO CLOUD TENANT SILO PROVISIONING & DEPLOYMENT SCRIPT
# ===================================================================================
#  Usage: ./scripts/deploy-utho-silo.sh <tenant-id> [encryption-key-base64]
# ===================================================================================

set -e

TENANT_ID="${1:-tenant-a}"
ENCRYPTION_KEY="${2:-k9Xf2P7mN4qZ8vL3wY5rT1bC6jH0sD4fG7uI2oK8pQ0=}"
NAMESPACE="tenant-${TENANT_ID}-silo"

echo "======================================================================"
echo "🚀 Provisioning Utho Cloud Isolated Silo: ${NAMESPACE}"
echo "======================================================================"

# 1. Create Tenant Namespace on Utho Managed Kubernetes
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# 2. Inject Per-Tenant KMS Secret
kubectl create secret generic medicos-secrets \
  --namespace="${NAMESPACE}" \
  --from-literal=ENCRYPTION_KEY="${ENCRYPTION_KEY}" \
  --from-literal=JWT_SECRET="SuperSecureJwtTokenSignatureKeyForTenant_${TENANT_ID}" \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Apply ConfigMap, Deployment, Service, NetworkPolicy, and Ingress
kubectl apply -n "${NAMESPACE}" -f k8s/configmap.yaml
kubectl apply -n "${NAMESPACE}" -f k8s/deployment.yaml
kubectl apply -n "${NAMESPACE}" -f k8s/service.yaml
kubectl apply -n "${NAMESPACE}" -f k8s/network-policy.yaml
kubectl apply -n "${NAMESPACE}" -f k8s/utho-ingress.yaml

echo "======================================================================"
echo "✅ Tenant Silo '${NAMESPACE}' successfully deployed on Utho Cloud!"
echo "======================================================================"
