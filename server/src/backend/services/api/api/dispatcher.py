import json
import uuid

import boto3
from botocore.exceptions import ClientError
from mypy_boto3_lambda import LambdaClient

from core.config import SETTINGS
from core.titan_logger import logger

lambda_client: LambdaClient = boto3.client("lambda", region_name=SETTINGS.AWS_REGION)


def _get_k8s_client():
    """Lazily create a Kubernetes BatchV1 API client using EKS cluster credentials."""
    from kubernetes import client as k8s_client, config as k8s_config

    eks = boto3.client("eks", region_name=SETTINGS.AWS_REGION)
    cluster_info = eks.describe_cluster(name=SETTINGS.GENERATION_JOB_EKS_CLUSTER)[
        "cluster"
    ]
    endpoint = cluster_info["endpoint"]
    ca_data = cluster_info["certificateAuthority"]["data"]

    # Get a bearer token via STS
    from botocore.signers import RequestSigner

    sts = boto3.client("sts", region_name=SETTINGS.AWS_REGION)
    service_id = sts.meta.service_model.service_id

    signer = RequestSigner(
        service_id,
        SETTINGS.AWS_REGION,
        "sts",
        "v4",
        sts._request_signer._credentials,
        sts._request_signer._event_emitter,
    )
    params = {
        "method": "GET",
        "url": f"https://sts.{SETTINGS.AWS_REGION}.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15",
        "body": {},
        "headers": {"x-k8s-aws-id": SETTINGS.GENERATION_JOB_EKS_CLUSTER},
        "context": {},
    }
    signed_url = signer.generate_presigned_url(
        params, region_name=SETTINGS.AWS_REGION, expires_in=60, operation_name=""
    )
    import base64

    token = "k8s-aws-v1." + base64.urlsafe_b64encode(signed_url.encode("utf-8")).decode(
        "utf-8"
    ).rstrip("=")

    import tempfile, os

    ca_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
    ca_file.write(base64.b64decode(ca_data))
    ca_file.close()

    configuration = k8s_client.Configuration()
    configuration.host = endpoint
    configuration.ssl_ca_cert = ca_file.name
    configuration.api_key = {"BearerToken": token}
    configuration.api_key_prefix = {"BearerToken": "Bearer"}

    api_client = k8s_client.ApiClient(configuration)
    return k8s_client.BatchV1Api(api_client), k8s_client


def create_k8s_job(job_id: str) -> str:
    """
    Creates a Kubernetes Job on EKS to run a generation task.

    :param job_id: The generation job ID to pass as an env var.
    :return: The Kubernetes Job name.
    """
    batch_api, k8s_client = _get_k8s_client()
    namespace = SETTINGS.GENERATION_JOB_EKS_NAMESPACE or "titan"
    job_name = f"gen-{job_id[:8]}-{uuid.uuid4().hex[:6]}"

    container = k8s_client.V1Container(
        name="generation",
        image=SETTINGS.GENERATION_JOB_EKS_IMAGE,
        env=[k8s_client.V1EnvVar(name="JOB_ID", value=job_id)],
        resources=k8s_client.V1ResourceRequirements(
            requests={"cpu": "16", "memory": "64Gi", "ephemeral-storage": "50Gi"},
            limits={"cpu": "16", "memory": "64Gi", "ephemeral-storage": "50Gi"},
        ),
    )

    pod_spec = k8s_client.V1PodSpec(
        service_account_name=SETTINGS.GENERATION_JOB_EKS_SERVICE_ACCOUNT
        or "titan-generation",
        restart_policy="Never",
        containers=[container],
    )

    job_spec = k8s_client.V1JobSpec(
        backoff_limit=0,
        ttl_seconds_after_finished=3600,
        template=k8s_client.V1PodTemplateSpec(
            metadata=k8s_client.V1ObjectMeta(
                labels={"app": "titan-generation", "job-id": job_id[:63]}
            ),
            spec=pod_spec,
        ),
    )

    job_body = k8s_client.V1Job(
        api_version="batch/v1",
        kind="Job",
        metadata=k8s_client.V1ObjectMeta(name=job_name, namespace=namespace),
        spec=job_spec,
    )

    try:
        batch_api.create_namespaced_job(namespace=namespace, body=job_body)
        logger.info(f"Created K8s job {job_name} for generation {job_id}")
    except Exception:
        logger.exception(f"Couldn't create K8s job for generation {job_id}")
        raise

    return job_name


def delete_k8s_job(job_name: str) -> bool:
    """
    Deletes a Kubernetes Job on EKS (cancels the generation).

    :param job_name: The Kubernetes Job name.
    :return: True if deleted successfully.
    """
    batch_api, k8s_client = _get_k8s_client()
    namespace = SETTINGS.GENERATION_JOB_EKS_NAMESPACE or "titan"

    try:
        batch_api.delete_namespaced_job(
            name=job_name,
            namespace=namespace,
            body=k8s_client.V1DeleteOptions(propagation_policy="Foreground"),
        )
        logger.info(f"Deleted K8s job {job_name}")
        return True
    except Exception:
        logger.exception(f"Couldn't delete K8s job {job_name}")
        return False


def invoke_function(function_name: str, function_params: dict) -> bytes:
    """
    Invokes a Lambda function.

    :param function_name: The name of the function to invoke.
    :param function_params: The parameters of the function as a dict. This dict
                                                    is serialized to JSON before it is sent to Lambda.
    :return: The response from the function invocation.
    """
    try:
        response = lambda_client.invoke(
            FunctionName=function_name,
            Payload=json.dumps(function_params),
            LogType="None",
        )
        logger.info(f"Invoked function {function_name}.")
    except ClientError:
        logger.exception(f"Couldn't invoke function {function_name}.")
        raise
    if response["StatusCode"] != 200 or response.get("FunctionError"):
        error_msg = response.get("FunctionError", "Unknown error")
        payload = response["Payload"].read()
        raise Exception(
            f"Function {function_name} returned status code {response['StatusCode']} with error: {error_msg}. Payload: {payload}"
        )
    return response["Payload"].read()


class Dispatcher:
    def __init__(self):
        self.deployment = SETTINGS.DEPLOYMENT

    def run_generation_job(self, job_id: str) -> str:
        if self.deployment == "aws":
            return create_k8s_job(job_id)
        elif self.deployment == "local":
            logger.info(
                f'Local deployment: invoke "run_generation_job" with job_id: {job_id}'
            )
            return "local"

    def stop_generation_job(self, k8s_job_name: str) -> bool:
        if self.deployment == "aws":
            return delete_k8s_job(k8s_job_name)
        elif self.deployment == "local":
            logger.info(
                f'Local deployment: invoke "stop_generation_job" with k8s_job_name: {k8s_job_name}'
            )
            return True
