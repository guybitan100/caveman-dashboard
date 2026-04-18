import boto3
import json
import os
import logging
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")

    assume_role_arn = os.environ.get("ROLE_ARN")
    hosted_zone_id = os.environ.get("HOSTED_ZONE_ID")
    assume_role_session_name = "titan-r53-recrods-mgmt"

    if not assume_role_arn or not hosted_zone_id:
        raise ValueError("Missing required environment variables")

    ############################################################
    # S3 Operations
    ############################################################
    s3_client = boto3.client('s3')

    # Read parameters from the S3 event
    s3_event = event['Records'][0]['s3']
    bucket_name = s3_event['bucket']['name']
    object_key = s3_event['object']['key']

    response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
    json_content = json.loads(response['Body'].read().decode('utf-8'))
    logger.info(f"Received JSON content: {json.dumps(json_content)}")

    change_batch = json_content.get("Changes")
    if not change_batch:
        raise ValueError("Missing required event parameter: change_batch")

    ############################################################
    # Route53 Operations
    ############################################################
    sts_client = boto3.client('sts')

    # Assume target role
    try:
        assumed_role_object = sts_client.assume_role(
            RoleArn=assume_role_arn,
            RoleSessionName=assume_role_session_name,
            DurationSeconds=900
        )
        temp_credentials = assumed_role_object['Credentials']
        logger.info(f"Assumed role {assume_role_arn} and got temporary credentials.")
    except ClientError as error:
        logger.error(
            f"Couldn't assume role {assume_role_arn}. Here's why: "
            f"{error.response['Error']['Message']}"
        )
        raise

    r53_client = boto3.client(
        'route53',
        aws_access_key_id=temp_credentials['AccessKeyId'],
        aws_secret_access_key=temp_credentials['SecretAccessKey'],
        aws_session_token=temp_credentials['SessionToken']
    )

    response = r53_client.change_resource_record_sets(
        HostedZoneId=hosted_zone_id, ChangeBatch=json_content
    )

    logger.info("DNS record managed successfully.")
