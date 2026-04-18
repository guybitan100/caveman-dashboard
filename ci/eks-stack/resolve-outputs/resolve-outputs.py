#!/usr/bin/env python3
from __future__ import annotations

import subprocess

import sys
from pathlib import Path

_actions_common = next(
    (
        str(p / "_common")
        for p in Path(__file__).resolve().parents
        if p.name == "actions"
    ),
    None,
)
if _actions_common and _actions_common not in sys.path:
    sys.path.insert(0, _actions_common)

get_logger = getattr(__import__("action_logger"), "get_logger")
env = getattr(__import__("env_utils"), "env")
write_output = getattr(__import__("github_utils"), "write_output")

_log = get_logger(__name__)


def aws_output(stack_name: str, output_key: str) -> str:
    cmd = [
        "aws",
        "cloudformation",
        "describe-stacks",
        "--stack-name",
        stack_name,
        "--query",
        f"Stacks[0].Outputs[?OutputKey=='{output_key}'].OutputValue",
        "--output",
        "text",
    ]
    try:
        result = subprocess.run(cmd, check=True, text=True, capture_output=True)
    except subprocess.CalledProcessError:
        return ""
    return (result.stdout or "").strip()


def fail(message: str) -> None:
    _log.error(message)
    raise SystemExit(1)


def _is_valid(value: str) -> bool:
    return bool(value and value != "None")


def main() -> int:
    skip_eks_deploy = env("SKIP_EKS_DEPLOY") == "true"
    env_name = env("ENV_NAME")
    platform_stack = env("PLATFORM_STACK")

    if skip_eks_deploy:
        _log.info("skip_eks_deploy=true: resolving outputs from existing stacks")
        candidate_env_stacks = [
            f"atlas-load-test-eks-{env_name}",
            f"atlas-load-test-eks-{env_name}-boosted",
        ]

        ecr_repo_uri = aws_output(platform_stack, "EcrRepositoryUri")
        log_group_name = aws_output(platform_stack, "LogGroupName")

        eks_cluster_name = ""
        irsa_role_arn = ""
        s3_bucket_name = ""
        resolved_env_stack = ""

        for env_stack in candidate_env_stacks:
            candidates = {
                k: aws_output(env_stack, k)
                for k in ("ClusterName", "IrsaRoleArn", "S3BucketName")
            }
            if all(_is_valid(v) for v in candidates.values()):
                resolved_env_stack = env_stack
                eks_cluster_name = candidates["ClusterName"]
                irsa_role_arn = candidates["IrsaRoleArn"]
                s3_bucket_name = candidates["S3BucketName"]
                break

        if resolved_env_stack:
            _log.info(f"Resolved env stack outputs from: {resolved_env_stack}")

        if not _is_valid(eks_cluster_name):
            eks_cluster_name = env("VAR_EKS_CLUSTER_NAME")
    else:
        ecr_repo_uri = env("DEPLOY_ECR_REPO_URI")
        log_group_name = env("DEPLOY_LOG_GROUP_NAME")
        eks_cluster_name = env("DEPLOY_EKS_CLUSTER_NAME")
        irsa_role_arn = env("DEPLOY_IRSA_ROLE_ARN")
        s3_bucket_name = env("DEPLOY_S3_BUCKET_NAME")

    required_values = {
        "ECR_REPO_URI": ecr_repo_uri,
        "LOG_GROUP_NAME": log_group_name,
        "EKS_CLUSTER_NAME": eks_cluster_name,
        "IRSA_ROLE_ARN": irsa_role_arn,
        "S3_BUCKET_NAME": s3_bucket_name,
    }

    for key, value in required_values.items():
        if not _is_valid(value):
            fail(f"Missing required EKS output: {key}")

    github_output = env("GITHUB_OUTPUT")
    if not github_output:
        fail("GITHUB_OUTPUT is not set")

    write_output("ecr_repo_uri", ecr_repo_uri)
    write_output("log_group_name", log_group_name)
    write_output("eks_cluster_name", eks_cluster_name)
    write_output("irsa_role_arn", irsa_role_arn)
    write_output("s3_bucket_name", s3_bucket_name)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
