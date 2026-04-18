import json

import boto3
from botocore.exceptions import ClientError
from mypy_boto3_ecs.type_defs import KeyValuePairTypeDef
from mypy_boto3_lambda import LambdaClient
from mypy_boto3_ecs import ECSClient

from core.config import SETTINGS
from core.titan_logger import logger

lambda_client: LambdaClient = boto3.client('lambda', region_name=SETTINGS.AWS_REGION)
ecs_client: ECSClient = boto3.client('ecs', region_name=SETTINGS.AWS_REGION)


def invoke_task(task_arn: str, environment: KeyValuePairTypeDef) -> str | None:
	"""
	Invokes a Fargate task.

	:param task_arn: The ARN of the task to invoke.
	:param environment: The environment variables to pass to the task
	:return: The response from the task invocation.
	"""
	try:
		response = ecs_client.run_task(
			cluster=SETTINGS.GENERATION_JOB_FARGATE_CLUSTER,
			taskDefinition=task_arn,
			launchType='FARGATE',
			networkConfiguration={
				'awsvpcConfiguration': {
					'subnets': SETTINGS.GENERATION_JOB_FARGATE_SUBNETS,
					'securityGroups': [SETTINGS.GENERATION_JOB_FARGATE_SECURITY_GROUP],
				}
			},
			overrides={
				'containerOverrides': [
					{
						'name': SETTINGS.GENERATION_JOB_FARGATE_CONTAINER_NAME,
						'environment': [
							environment
						]
					}
				]
			}
		)
		logger.info(f"Invoked task {task_arn}.")
	except ClientError:
		logger.exception(f"Couldn't invoke task {task_arn}.")
		raise
	return response["tasks"][0]["taskArn"]


def stop_task(task_id: str) -> bool:
	response = ecs_client.stop_task(
		cluster=SETTINGS.GENERATION_JOB_FARGATE_CLUSTER,
		task=task_id,
	)
	return response["task"]["stopCode"] == 'UserInitiated'


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
		if response['StatusCode'] != 200 or response.get('FunctionError'):
			error_msg = response.get('FunctionError', 'Unknown error')
			payload = response['Payload'].read()
			raise Exception(f"Function {function_name} returned status code {response['StatusCode']} with error: {error_msg}. Payload: {payload}")
		return response['Payload'].read()



class Dispatcher:
	def __init__(self):
		self.deployment = SETTINGS.DEPLOYMENT
		
	def run_generation_job(self, job_id: str) -> str :
		if self.deployment == 'aws':
			return invoke_task(SETTINGS.GENERATION_JOB_FARGATE_ARN, {"name": 'JOB_ID', "value": job_id})
		elif self.deployment == 'local':
			logger.info(f'Local deployment: invoke "run_generation_job" with job_id: {job_id}')
			return 'local'
	
	def stop_generation_job(self, ecs_task_id: str) -> bool:
		if self.deployment == 'aws':
			return stop_task(ecs_task_id)
		elif self.deployment == 'local':
			logger.info(f'Local deployment: invoke "stop_generation_job" with ecs_task_id: {ecs_task_id}')
			return True
