import os
import json
import logging
import boto3
from pymongo import MongoClient
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("validate_connectivity.log"),
        logging.StreamHandler(),
    ],
)

# Load AWS configuration
REGION = os.getenv("AWS_REGION", "eu-central-1")
GLOBAL_PEM_DIR = Path(__file__).parent

# Initialize Boto3 session
try:
    logging.info("Initializing Boto3 session with profile...")
    session = boto3.Session(region_name=REGION)
except Exception as e:
    logging.warning(f"Failed to initialize Boto3 session with profile: {e}")
    logging.info("Falling back to without profile...")
    try:
        session = boto3.Session(region_name=REGION)
        logging.info(f"Using region '{REGION}' without profile")
    except Exception as e:
        logging.error(f"Failed to initialize Boto3 session without profile: {e}")
        raise
finally:
    cloudformation = session.client("cloudformation")
    cloudwatch = session.client("cloudwatch")
    secretsmanager = session.client("secretsmanager")
    ssm = session.client("ssm")


def download_pem_file():
    """Download the global-bundle.pem file from AWS S3."""
    try:
        logging.info("Downloading global-bundle.pem file...")
        url ='https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem'
        os.system(f"cd {str(GLOBAL_PEM_DIR)};wget {url} -O global-bundle.pem",)
        logging.info("Downloaded global-bundle.pem file.")
    except Exception as e:
        logging.error(f"Failed to download global-bundle.pem file: {e}")
        raise
    

def get_parameter_outputs(param_name):
    """Retrieve all parameter outputs."""
    try:
        logging.info(f"Fetching outputs from parameter '{param_name}'...")

        # Fetch the parameter from parameter store
        param_response = ssm.get_parameter(Name=param_name)
        param_value = param_response['Parameter']['Value']

        # Parse the parameter value to get the outputs
        outputs = json.loads(param_value)
        logging.info(f"Found outputs: {outputs}")
        return outputs

    except Exception as e:
        logging.error(f"Failed to fetch parameter outputs: {e}")
        raise


def get_secret(secret_name):
    """Retrieve and validate a secret from AWS Secrets Manager."""
    try:
        logging.info(f"Retrieving secret '{secret_name}'...")
        response = secretsmanager.get_secret_value(SecretId=secret_name)
        if "SecretString" in response:
            secret = json.loads(response["SecretString"])
            if "username" not in secret or "password" not in secret:
                raise KeyError(
                    f"Secret '{secret_name}' is missing required keys: 'username' and 'password'"
                )
            logging.info(f"Successfully retrieved secret '{secret_name}'")
            return secret
        raise ValueError(
            f"Secret '{secret_name}' does not contain a valid SecretString."
        )
    except Exception as e:
        logging.error(f"Failed to retrieve secret '{secret_name}': {e}")
        raise


def test_documentdb_connection(endpoint, username, password):
    """Test connectivity to DocumentDB."""
    try:
        logging.info("Testing DocumentDB connection...")
        if not GLOBAL_PEM_DIR.joinpath("global-bundle.pem").exists():
            download_pem_file()
        host, port = endpoint, 27017
        client = MongoClient(
            host=host,
            port=int(port),
            username=username,
            password=password,
            ssl=True,
            tlsCAFile=str(GLOBAL_PEM_DIR / "global-bundle.pem"),
            serverSelectionTimeoutMS=5000,
            tlsAllowInvalidCertificates=True,
            tlsAllowInvalidHostnames=True,
            readPreference="secondaryPreferred",
            retryWrites=False,
            # directConnection=True,
            replicaSet="rs0",
        )
        client.admin.command("ping")
        logging.info("DocumentDB connection successful.")
        return True
    except Exception as e:
        logging.error(f"DocumentDB connection failed: {e}")
        return False


def main():
    try:
        # Fetch OpenSearch, DocumentDB endpoints
        infraOutputParameter = '/titan/infra/outputs'
        infraOutputs = get_parameter_outputs(infraOutputParameter)
        docdb_endpoint = infraOutputs["documentDBClusterEndpoint"]

        # Fetch credentials from Secrets Manager
        docdb_credentials = get_secret("/titan/docdb/masteruser")

        logging.info("###################### Testing official endpoints.. ######################")

        if test_documentdb_connection(
            docdb_endpoint,
            docdb_credentials["username"],
            docdb_credentials["password"],
        ):
            logging.info("DocumentDB connectivity: Success")
        else:
            raise Exception("DocumentDB connectivity failed.")


        logging.info("###################### Testing custom endpoints.. ######################")
        if test_documentdb_connection(
            docdb_endpoint,
            docdb_credentials["username"],
            docdb_credentials["password"],
        ):
            logging.info("DocumentDB connectivity: Success")
        else:
            raise Exception("DocumentDB connectivity: Failed")
    except Exception as e:
        logging.error(f"An error occurred in the main process: {e}")


if __name__ == "__main__":
    main()
