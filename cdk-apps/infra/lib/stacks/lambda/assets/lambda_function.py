import os
import json
import boto3
import requests
from requests_aws4auth import AWS4Auth
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
OPENSEARCH_URL = "https://" + os.getenv('OPENSEARCH_URL')
SECRET_ARN = os.getenv('SECRET_ARN')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
BASE_PATH = os.getenv('BASE_PATH')
REGION = os.getenv('REGION')
S3_ENDPOINT = os.getenv('S3_ENDPOINT')
SNAPSHOT_ROLE_ARN = os.getenv('SNAPSHOT_ROLE_ARN')


def get_aws_auth():
    """Generate AWS4Auth credentials for OpenSearch."""
    try:
        session = boto3.Session()
        credentials = session.get_credentials()
        sts_client = session.client('sts')

        # Retrieve the current role ARN
        identity = sts_client.get_caller_identity()
        
        # Extract the original role ARN from the assumed role ARN
        role_arn = identity['Arn']

        # Convert assumed role ARN to IAM role ARN
        if role_arn.startswith("arn:aws:sts::"):
            account_id = role_arn.split(":")[4]  # Extract account ID
            role_name = role_arn.split("/")[-2]  # Extract role name
            iam_role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"  # Construct IAM role ARN
            print("IAM Role ARN:", iam_role_arn)
        else:
            print("Unexpected ARN format:", role_arn)

        aws_auth = AWS4Auth(
            credentials.access_key,
            credentials.secret_key,
            REGION,
            'es',
            session_token=credentials.token,
        )
        return aws_auth, iam_role_arn
    except Exception as e:
        logger.error(f"Failed to retrieve AWS credentials: {e}")
        raise


def get_credentials(secret_arn):
    """Retrieve OpenSearch master user credentials from AWS Secrets Manager."""
    try:
        client = boto3.client('secretsmanager')
        response = client.get_secret_value(SecretId=secret_arn)
        logger.info("Successfully retrieved credentials from Secrets Manager.")
        secret = json.loads(response['SecretString'])
        return secret['username'], secret['password']
    except Exception as e:
        logger.error(f"Failed to retrieve credentials from Secrets Manager: {e}")
        raise


def get_latest_snapshot(opensearch_url, auth):
    """Fetch the latest snapshot from the OpenSearch snapshot repository."""
    try:
        response = requests.get(
            f'{opensearch_url}/_snapshot/{S3_BUCKET_NAME}/_all',
            auth=auth,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()

        snapshots = response.json().get('snapshots', [])
        if not snapshots:
            logger.warning("No snapshots found in the repository.")
            raise Exception("No snapshots found in the repository.")

        # Find the latest snapshot based on the `start_time` field
        latest_snapshot = max(snapshots, key=lambda x: x['start_time'])
        logger.info(f"Latest snapshot: {latest_snapshot['snapshot']}")
        return latest_snapshot['snapshot']
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to retrieve snapshots: {e}")
        raise


def map_all_access_role(username, role, opensearch_url, password):
    """Map roles to users in OpenSearch."""
    headers = {'Content-Type': 'application/json'}
    role_mapping_payload = {
        "backend_roles": [role],
        "users": [username]
    }
    try:
        response = requests.put(
            f'{opensearch_url}/_plugins/_security/api/rolesmapping/all_access',
            headers=headers,
            auth=(username, password),
            data=json.dumps(role_mapping_payload)
        )
        response.raise_for_status()
        logger.info(f"Role mapping (all_access) updated successfully: {response.text}")
    except Exception as e:
        logger.error(f"Failed to update role mapping (all_access): {e}")

def map_snapshot_role(username, role, opensearch_url, password):
    """Map roles to users in OpenSearch."""
    headers = {'Content-Type': 'application/json'}
    role_mapping_payload = {
        "backend_roles": [role],
        "users": [username]
    }
    try:
        response = requests.put(
            f'{opensearch_url}/_plugins/_security/api/rolesmapping/manage_snapshots',
            headers=headers,
            auth=(username, password),
            data=json.dumps(role_mapping_payload)
        )
        response.raise_for_status()
        logger.info(f"Role mapping (manage_snapshots) updated successfully: {response.text}")
    except Exception as e:
        logger.error(f"Failed to update role mapping (manage_snapshots): {e}")

def register_snapshot_repository(opensearch_url, auth):
    """Register an S3 snapshot repository in OpenSearch."""
    snapshot_repository_payload = {
        "type": "s3",
        "settings": {
            "bucket": S3_BUCKET_NAME,
            "base_path": BASE_PATH,
            "region": REGION,
            "endpoint": S3_ENDPOINT,
            "role_arn": SNAPSHOT_ROLE_ARN
        }
    }
    try:
        response = requests.put(
            f'{opensearch_url}/_snapshot/{S3_BUCKET_NAME}',
            headers={'Content-Type': 'application/json'},
            auth=auth,
            data=json.dumps(snapshot_repository_payload)
        )
        response.raise_for_status()
        logger.info(f"Snapshot repository registered successfully: {response.text}")
    except Exception as e:
        logger.error(f"Failed to register snapshot repository: {e}")

def get_latest_snapshot(opensearch_url, auth):
    """Fetch the latest snapshot from the OpenSearch snapshot repository."""
    try:
        response = requests.get(
            f'{opensearch_url}/_snapshot/{S3_BUCKET_NAME}/_all',
            auth=auth,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        snapshots = response.json().get('snapshots', [])
        if not snapshots:
            logger.warning("No snapshots found in the repository.")
            raise Exception("No snapshots found in the repository.")

        # Find the latest snapshot based on the `start_time` field
        latest_snapshot = max(snapshots, key=lambda x: x['start_time'])
        logger.info(f"Latest snapshot: {latest_snapshot['snapshot']}")
        return latest_snapshot['snapshot']
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to retrieve snapshots: {e}")
        raise

def get_existing_indices(opensearch_url, auth):
    """
    Retrieve a list of existing indices from OpenSearch.

    Args:
        opensearch_url (str): The base URL of the OpenSearch cluster.
        auth (tuple): Authentication credentials (username, password or other auth mechanism).

    Returns:
        set: A set of existing index names.
    """
    try:
        response = requests.get(
            f'{opensearch_url}/_cat/indices?format=json',
            headers={'Content-Type': 'application/json'},
            auth=auth
        )
        response.raise_for_status()
        indices_status = response.json()
        existing_indices = {index['index'] for index in indices_status}
        logger.info(f"Existing indices retrieved: {existing_indices}")
        return existing_indices
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to retrieve existing indices: {e}")
        raise

def restore_missing_indices(opensearch_url, auth, latest_snapshot, desired_indices):
    """
    Restore only missing indices from the latest snapshot.

    Args:
        opensearch_url (str): The base URL of the OpenSearch cluster.
        auth (tuple): Authentication credentials (username, password or other auth mechanism).
        latest_snapshot (str): The name of the snapshot to restore.
        desired_indices (list): A list of indices that need to be restored.
    """
    try:
        # Get the set of existing indices
        existing_indices = get_existing_indices(opensearch_url, auth)

        # Compute the set of missing indices
        missing_indices = set(desired_indices) - existing_indices
        if not missing_indices:
            logger.info("No missing indices to restore.")
            return

        logger.info(f"Missing indices to restore: {missing_indices}")

        # Restore only the missing indices
        restore_payload = {
            "indices": ",".join(missing_indices),
            "ignore_unavailable": True,
            "include_global_state": False
        }

        response = requests.post(
            f'{opensearch_url}/_snapshot/{S3_BUCKET_NAME}/{latest_snapshot}/_restore',
            headers={'Content-Type': 'application/json'},
            auth=auth,
            data=json.dumps(restore_payload)
        )
        response.raise_for_status()
        logger.info(f"Missing indices restored successfully: {response.text}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to restore missing indices: {e}")
        raise

def verify_indices(opensearch_url, auth):
    """Verify the status of all indices in OpenSearch."""
    try:
        response = requests.get(
            f'{opensearch_url}/_cat/indices/_all?pretty',
            headers={'Content-Type': 'application/json'},
            auth=auth
        )
        response.raise_for_status()
        logger.info(f"Indices status: {response.text}")
    except Exception as e:
        logger.error(f"Failed to verify indices: {e}")

def lambda_handler(event, context):
    try:
        # Indexes required
        desired_indices = [
            "image_index_v2", "chats_index", "apps_index", "audio_index_v2",
            "entity_index", "video_index_v2", "text_index", "fields_index",
            "files_index", "cell-towers", "urls_index", "name_index", "crypto_index"
        ]

        # Get AWS authentication and credentials
        auth, role = get_aws_auth()

        # Get Admin credentials
        username, password = get_credentials(SECRET_ARN)

        map_all_access_role(username, role, OPENSEARCH_URL, password)
        map_snapshot_role(username, role, OPENSEARCH_URL, password)
        register_snapshot_repository(OPENSEARCH_URL, auth)
        latest_snapshot = get_latest_snapshot(OPENSEARCH_URL, auth)
        restore_missing_indices(OPENSEARCH_URL, auth, latest_snapshot, desired_indices)
        verify_indices(OPENSEARCH_URL, auth)

        logger.info("Snapshot restoration process completed successfully.")
    except Exception as general_error:
        logger.critical(f"Unexpected error occurred: {general_error}")
