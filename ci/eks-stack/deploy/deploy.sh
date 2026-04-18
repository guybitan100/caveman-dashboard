#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${EKS_CLUSTER_NAME:-}" ]]; then
  EKS_CLUSTER_NAME="eks-app-${ENV_NAME}"
  echo "EKS_CLUSTER_NAME is empty; using fallback cluster name: ${EKS_CLUSTER_NAME}" >&2
fi

SERVICE_ACCOUNT_NAMESPACE=${SERVICE_ACCOUNT_NAMESPACE:-atlas-load}
SERVICE_ACCOUNT_NAME_PREFIX=${SERVICE_ACCOUNT_NAME_PREFIX:-atlas-load-}

STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$PLATFORM_STACK" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || true)
if [[ "$STACK_STATUS" == "REVIEW_IN_PROGRESS" ]]; then
  echo "Platform stack is in REVIEW_IN_PROGRESS; deleting and recreating..." >&2
  aws cloudformation delete-stack --stack-name "$PLATFORM_STACK"
  aws cloudformation wait stack-delete-complete --stack-name "$PLATFORM_STACK"
fi

echo "Validating existing platform resources..."
_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
if [[ -z "${_ACCOUNT_ID:-}" ]]; then
  echo "Unable to access AWS credentials in deploy action" >&2
  exit 1
fi

# Derive bucket name from AWS account ID (matches config.py get_upload_s3_bucket pattern)
SOURCE_UPLOAD_BUCKET_NAME=${SOURCE_UPLOAD_BUCKET_NAME:-"clbt-${_ACCOUNT_ID}-e2e-performance-testing"}

AWS_REGION_EFFECTIVE=${AWS_REGION:-$(aws configure get region)}
if [[ -z "${AWS_REGION_EFFECTIVE:-}" || "$AWS_REGION_EFFECTIVE" == "None" ]]; then
  AWS_REGION_EFFECTIVE="us-east-1"
  echo "WARNING: AWS region could not be resolved; falling back to ${AWS_REGION_EFFECTIVE}" >&2
fi

check_log_group_visibility() {
  local out rc
  set +e
  out=$(aws logs describe-log-groups \
    --region "$AWS_REGION_EFFECTIVE" \
    --log-group-name-prefix "$EKS_LOG_GROUP_NAME" \
    --query 'logGroups[?logGroupName==`'"$EKS_LOG_GROUP_NAME"'`].logGroupName' \
    --output text 2>&1)
  rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    if [[ "$out" == *"AccessDenied"* || "$out" == *"AccessDeniedException"* || "$out" == *"UnauthorizedOperation"* || "$out" == *"ExpiredToken"* || "$out" == *"UnrecognizedClientException"* ]]; then
      return 2
    fi
    return 1
  fi

  if grep -Fx "$EKS_LOG_GROUP_NAME" >/dev/null <<<"$out"; then
    return 0
  fi
  return 1
}

CREATE_ECR_REPOSITORY=false
if aws ecr describe-repositories --repository-names "$ECR_REPOSITORY_NAME" >/dev/null 2>&1; then
  echo "ECR repository exists: $ECR_REPOSITORY_NAME"
else
  echo "ECR repository not found: $ECR_REPOSITORY_NAME" >&2
  CREATE_ECR_REPOSITORY=true
fi

CREATE_LOG_GROUP=false
if check_log_group_visibility; then
  echo "CloudWatch log group exists: $EKS_LOG_GROUP_NAME"
else
  echo "CloudWatch log group not found: $EKS_LOG_GROUP_NAME" >&2
  CREATE_LOG_GROUP=true
fi

aws cloudformation deploy \
  --stack-name "$PLATFORM_STACK" \
  --template-file ci/cloudformation/atlas-platform-eks-stack.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    CreateEcrRepository="$CREATE_ECR_REPOSITORY" \
    EcrRepositoryName="$ECR_REPOSITORY_NAME" \
    CreateLogGroup="$CREATE_LOG_GROUP" \
    LogGroupName="$EKS_LOG_GROUP_NAME" \
    ExportPrefix="$EXPORT_PREFIX"

AWS_ACCOUNT_ID="$_ACCOUNT_ID"

echo "Platform stack deployed in account=${AWS_ACCOUNT_ID} region=${AWS_REGION_EFFECTIVE}"
LOG_GROUP_VISIBLE=false
LOG_GROUP_AUTH_WARNING=false
for _ in {1..18}; do
  if check_log_group_visibility; then
    LOG_GROUP_VISIBLE=true
    break
  fi
  rc=$?
  if [[ $rc -eq 2 ]]; then
    LOG_GROUP_AUTH_WARNING=true
    break
  fi
  sleep 5
done

if [[ "$CREATE_LOG_GROUP" == "true" && "$LOG_GROUP_VISIBLE" != "true" && "$LOG_GROUP_AUTH_WARNING" != "true" ]]; then
  echo "CloudWatch log group still not visible; attempting direct create fallback in account=${AWS_ACCOUNT_ID} region=${AWS_REGION_EFFECTIVE}: $EKS_LOG_GROUP_NAME"
  set +e
  CREATE_OUT=$(aws logs create-log-group \
    --region "$AWS_REGION_EFFECTIVE" \
    --log-group-name "$EKS_LOG_GROUP_NAME" 2>&1)
  CREATE_RC=$?
  set -e

  if [[ $CREATE_RC -eq 0 ]]; then
    echo "Direct create-log-group fallback succeeded: $EKS_LOG_GROUP_NAME"
  elif [[ "$CREATE_OUT" == *"ResourceAlreadyExistsException"* ]]; then
    echo "CloudWatch log group already exists (create fallback): $EKS_LOG_GROUP_NAME"
  elif [[ "$CREATE_OUT" == *"AccessDenied"* || "$CREATE_OUT" == *"AccessDeniedException"* || "$CREATE_OUT" == *"UnauthorizedOperation"* || "$CREATE_OUT" == *"UnrecognizedClientException"* || "$CREATE_OUT" == *"ExpiredToken"* ]]; then
    LOG_GROUP_AUTH_WARNING=true
    echo "WARNING: create-log-group fallback skipped due to permissions in account=${AWS_ACCOUNT_ID} region=${AWS_REGION_EFFECTIVE}: $EKS_LOG_GROUP_NAME" >&2
  else
    echo "WARNING: create-log-group fallback failed in account=${AWS_ACCOUNT_ID} region=${AWS_REGION_EFFECTIVE}: $EKS_LOG_GROUP_NAME :: $CREATE_OUT" >&2
  fi

  if [[ "$LOG_GROUP_AUTH_WARNING" != "true" ]]; then
    for _ in {1..12}; do
      if check_log_group_visibility; then
        LOG_GROUP_VISIBLE=true
        break
      fi
      rc=$?
      if [[ $rc -eq 2 ]]; then
        LOG_GROUP_AUTH_WARNING=true
        break
      fi
      sleep 5
    done
  fi
fi

if [[ "$LOG_GROUP_VISIBLE" == "true" ]]; then
  echo "Verified CloudWatch log group exists: $EKS_LOG_GROUP_NAME"
elif [[ "$LOG_GROUP_AUTH_WARNING" == "true" ]]; then
  echo "WARNING: CloudWatch log group verification skipped due to credential permissions in region ${AWS_REGION_EFFECTIVE}: $EKS_LOG_GROUP_NAME" >&2
else
  echo "WARNING: CloudWatch log group is still not visible after retries in account=${AWS_ACCOUNT_ID} region=${AWS_REGION_EFFECTIVE}: $EKS_LOG_GROUP_NAME" >&2
fi

STACK_NAME="atlas-load-test-eks-${ENV_NAME}"
TEMPLATE_FILE="ci/cloudformation/env-stack.eks.yaml"

echo "Validating EKS deploy inputs..."
echo "Stack: $STACK_NAME"
echo "Template: $TEMPLATE_FILE"

aws eks describe-cluster --name "$EKS_CLUSTER_NAME" >/dev/null

CLUSTER_OIDC_ISSUER=$(aws eks describe-cluster \
  --name "$EKS_CLUSTER_NAME" \
  --query 'cluster.identity.oidc.issuer' \
  --output text)

if [[ -z "${CLUSTER_OIDC_ISSUER:-}" || "$CLUSTER_OIDC_ISSUER" == "None" ]]; then
  echo "Unable to resolve OIDC issuer from cluster: $EKS_CLUSTER_NAME" >&2
  exit 1
fi

DERIVED_OIDC_HOSTPATH="${CLUSTER_OIDC_ISSUER#https://}"
DERIVED_OIDC_PROVIDER_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/${DERIVED_OIDC_HOSTPATH}"

if [[ -z "${EKS_OIDC_ISSUER_HOSTPATH:-}" || "$EKS_OIDC_ISSUER_HOSTPATH" != "$DERIVED_OIDC_HOSTPATH" ]]; then
  echo "Using cluster-derived OIDC issuer hostpath: ${DERIVED_OIDC_HOSTPATH}" >&2
  EKS_OIDC_ISSUER_HOSTPATH="$DERIVED_OIDC_HOSTPATH"
fi

if [[ -z "${EKS_OIDC_PROVIDER_ARN:-}" || "$EKS_OIDC_PROVIDER_ARN" != "$DERIVED_OIDC_PROVIDER_ARN" ]]; then
  echo "Using cluster-derived OIDC provider ARN: ${DERIVED_OIDC_PROVIDER_ARN}" >&2
  EKS_OIDC_PROVIDER_ARN="$DERIVED_OIDC_PROVIDER_ARN"
fi

aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$EKS_OIDC_PROVIDER_ARN" >/dev/null

if [[ "$EKS_OIDC_PROVIDER_ARN" != *"$EKS_OIDC_ISSUER_HOSTPATH" ]]; then
  echo "OIDC mismatch: provider ARN does not include issuer hostpath" >&2
  echo "EKS_OIDC_PROVIDER_ARN=$EKS_OIDC_PROVIDER_ARN" >&2
  echo "EKS_OIDC_ISSUER_HOSTPATH=$EKS_OIDC_ISSUER_HOSTPATH" >&2
  exit 1
fi

if ! aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE_FILE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    EnvironmentName="$ENV_NAME" \
    ExistingClusterName="$EKS_CLUSTER_NAME" \
    OidcProviderArn="$EKS_OIDC_PROVIDER_ARN" \
    OidcIssuerHostPath="$EKS_OIDC_ISSUER_HOSTPATH" \
    ServiceAccountNamespace="$SERVICE_ACCOUNT_NAMESPACE" \
    ServiceAccountName="$SERVICE_ACCOUNT_NAME_PREFIX" \
    SourceUploadBucketName="$SOURCE_UPLOAD_BUCKET_NAME"; then
  echo "CloudFormation deploy failed, dumping recent stack events:" >&2
  aws cloudformation describe-stack-events \
    --stack-name "$STACK_NAME" \
    --max-items 30 \
    --query 'StackEvents[].{Time:Timestamp,Status:ResourceStatus,Type:ResourceType,LogicalId:LogicalResourceId,Reason:ResourceStatusReason}' \
    --output table || true

  echo "Listing latest change sets for diagnostics:" >&2
  aws cloudformation list-change-sets \
    --stack-name "$STACK_NAME" \
    --query 'Summaries[].[CreationTime,ChangeSetName,Status,StatusReason]' \
    --output table || true

  CHANGE_SET_NAME=$(aws cloudformation list-change-sets \
    --stack-name "$STACK_NAME" \
    --query 'Summaries | sort_by(@,&CreationTime)[-1].ChangeSetName' \
    --output text 2>/dev/null || true)

  if [[ -n "${CHANGE_SET_NAME:-}" && "$CHANGE_SET_NAME" != "None" ]]; then
    echo "Describing latest change set: $CHANGE_SET_NAME" >&2
    aws cloudformation describe-change-set \
      --stack-name "$STACK_NAME" \
      --change-set-name "$CHANGE_SET_NAME" \
      --query '{Status:Status,StatusReason:StatusReason,Parameters:Parameters}' \
      --output yaml || true
  fi
  exit 1
fi

get_cf_output() {
  local stack="$1" key="$2"
  aws cloudformation describe-stacks \
    --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue" \
    --output text
}

ECR_REPO_URI=$(get_cf_output "$PLATFORM_STACK" "EcrRepositoryUri")
LOG_GROUP_NAME=$(get_cf_output "$PLATFORM_STACK" "LogGroupName")
EKS_CLUSTER_NAME_OUT=$(get_cf_output "$STACK_NAME" "ClusterName")
IRSA_ROLE_ARN=$(get_cf_output "$STACK_NAME" "IrsaRoleArn")
S3_BUCKET_NAME=$(get_cf_output "$STACK_NAME" "S3BucketName")

echo "ecr_repo_uri=$ECR_REPO_URI" >> "$GITHUB_OUTPUT"
echo "log_group_name=$LOG_GROUP_NAME" >> "$GITHUB_OUTPUT"
echo "eks_cluster_name=$EKS_CLUSTER_NAME_OUT" >> "$GITHUB_OUTPUT"
echo "irsa_role_arn=$IRSA_ROLE_ARN" >> "$GITHUB_OUTPUT"
echo "s3_bucket_name=$S3_BUCKET_NAME" >> "$GITHUB_OUTPUT"
