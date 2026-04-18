#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${JOB_NAME}" ]]; then
  echo "::warning::Missing job name; skipping pod cleanup verification"
  exit 0
fi

if [[ "${DELETE_JOB_FIRST,,}" == "true" ]]; then
  echo "Best-effort cleanup: deleting job ${JOB_NAME} in namespace ${NAMESPACE}"
  kubectl delete job "${JOB_NAME}" --namespace "${NAMESPACE}" --ignore-not-found --wait=false || \
    echo "::warning::Unable to delete job ${JOB_NAME}; continuing with verification"
fi

if [[ "${FORCE_DELETE_PODS,,}" == "true" ]]; then
  echo "Best-effort cleanup: force-deleting pods for job ${JOB_NAME}"
  kubectl delete pod --namespace "${NAMESPACE}" -l "job-name=${JOB_NAME}" --ignore-not-found --wait=false --force --grace-period=0 || \
    echo "::warning::Unable to force-delete pods for ${JOB_NAME}; continuing with verification"
fi

for attempt in $(seq 1 "${MAX_ATTEMPTS}"); do
  PODS="$(kubectl get pods --namespace "${NAMESPACE}" -l "job-name=${JOB_NAME}" --no-headers 2>/dev/null || true)"
  if [[ -z "${PODS// }" ]]; then
    echo "Pods removed for job ${JOB_NAME} in namespace ${NAMESPACE}"
    exit 0
  fi

  echo "Attempt ${attempt}/${MAX_ATTEMPTS}: pod(s) still present for ${JOB_NAME}"
  echo "${PODS}"
  sleep "${SLEEP_SECONDS}"
done

echo "::error::Pod(s) were not removed for job ${JOB_NAME} in namespace ${NAMESPACE}"
kubectl get pods --namespace "${NAMESPACE}" -l "job-name=${JOB_NAME}" -o wide || true
exit 1
