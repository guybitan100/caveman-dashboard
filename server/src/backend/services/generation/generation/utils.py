import json
from functools import wraps
from typing import Callable, Protocol

from botocore.exceptions import ClientError
from types_aiobotocore_lambda import LambdaClient

from core.six_logger import logger
from model.job import GenerationJob
from model.phase import SixPhase
from model.status import PhaseStatus
from six_db.jobs import db_job_utils


class EngineCallable(Protocol):
    def __call__(self, job: GenerationJob) -> None: ...


def six_phase(phase: SixPhase) -> Callable[[EngineCallable], EngineCallable]:
    """
    Decorator for phase functions. All function must have job (GenerationJob) as the first argument.
    """
    def decorator(phase_func: EngineCallable) -> EngineCallable:
        @wraps(phase_func)
        def wrapper(job: GenerationJob, *args, **kwargs) -> int | None:
            db_job_utils.insert_phase(job_id=job.job_id, phase=phase)
            try:
                logger.info(f"Starting {phase}", job_id=job.job_id)
                result = phase_func(job, *args, **kwargs)
                _update_phase_status(job_id=job.job_id, phase=phase, status=PhaseStatus.Done)
                logger.info(f"{phase} done", job_id=job.job_id)
                return result
            except Exception as e:
                logger.error(f"{phase} failed for job {job.job_id}: {e}", error=e)
                _update_phase_status(job_id=job.job_id, phase=phase, status=PhaseStatus.Failed)
                raise e
        return wrapper
    return decorator


def _update_phase_status(job_id: str, phase: SixPhase, status: PhaseStatus):
    # Todo: emit websocket event
    db_job_utils.update_phase_status(job_id=job_id, status=status, phase=phase)
    
    
class LambdaException(Exception):
    pass

    
async def invoke_function(lambda_client: LambdaClient, function_name: str, function_params: dict) -> bytes:
        """
        Invokes a Lambda function.

        :param lambda_client: The aioboto3 client for Lambda.
        :param function_name: The name of the function to invoke.
        :param function_params: The parameters of the function as a dict. This dict
                                is serialized to JSON before it is sent to Lambda.
        :return: The response from the function invocation.
        """
        try:
            response = await lambda_client.invoke(
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
            raise LambdaException(f"Function {function_name} returned status code {response['StatusCode']} with error: {error_msg}. Payload: {payload}")
        return await response['Payload'].read()
