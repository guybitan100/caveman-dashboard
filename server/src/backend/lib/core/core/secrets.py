import json
import time

import boto3
import base64

import requests
from botocore.exceptions import ClientError

# Suppress warnings
from loguru import logger

requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)

region_name = "us-east-1"


def get_secret(config_name: str, secret_prefix: str) -> str | None:
    secret_name = _config_name_to_secret_name[config_name]
    secret_key = f"{secret_prefix}/{secret_name}"
    secret = _get_secret(secret_key=secret_key)
    if secret is None:
        logger.warn(
            f"Could not get secret (key={secret_key}), returned value is None.\n"
            f"Check that the key exists, and you have permissions to access AWS SecretsManager."
        )
        return None
    try:
        func = _config_name_to_secret_function[config_name]
    except KeyError:
        func = _default_get_secret
    return func(secret)


class SixSecretsManagerError(Exception):
    pass


def _get_secret(secret_key: str) -> dict | bytes:
    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager", region_name=region_name)
    try:
        get_secret_value_response = client.get_secret_value(SecretId=secret_key)
    except ClientError as e:
        if e.response["Error"]["Code"] == "InternalServiceErrorException":
            # An error occurred on the server side.
            # Deal with the exception here, and/or rethrow at your discretion.
            time.sleep(5)
            try:
                get_secret_value_response = client.get_secret_value(SecretId=secret_key)
                #TODO (during draft refactor) should this be returned
            except ClientError as e:
                raise SixSecretsManagerError from e
    else:
        # Decrypts secret using the associated KMS key.
        # Depending on whether the secret is a string or binary, one of these fields will be populated.
        if "SecretString" in get_secret_value_response:
            secret = get_secret_value_response["SecretString"]
            return json.loads(secret)
        else:
            decoded_binary_secret = base64.b64decode(get_secret_value_response["SecretBinary"])
            return decoded_binary_secret


def _get_postgres_connection_string(secret: dict) -> str:
    return f'postgresql+psycopg2://{secret["username"]}:{secret["password"]}@{secret["host"]}:{secret["port"]}/{secret["dbname"]}'


def _default_get_secret(secret: dict | bytes) -> str | bytes:
    if type(secret) is bytes:
        return secret
    return secret["value"]


_config_name_to_secret_function = {"SIX_DB_ENGINE": _get_postgres_connection_string}

_config_name_to_secret_name = {
    "SIX_DB_ENGINE": "six/postgres/1",
}
