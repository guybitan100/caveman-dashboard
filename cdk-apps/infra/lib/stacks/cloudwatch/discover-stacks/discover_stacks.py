import re
import boto3
import logging
import os
import json
from markdownify import markdownify  # type: ignore

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("/tmp/discover_stacks.log"),
        logging.StreamHandler(),
    ],
)

# Load AWS configuration
REGION = os.getenv("AWS_REGION", "eu-central-1")
PROFILE = os.getenv("AWS_PROFILE", "aws-saas-platform-ai-internal")
CONFIG_FILE = os.getenv("AWS_CONFIG_FILE", "~/.aws/config")

# Initialize Boto3 session
try:
    logging.info("Initializing Boto3 session with profile...")
    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    cloudformation = session.client("cloudformation")
    cloudwatch = session.client("cloudwatch")
    logging.info(f"Using profile '{PROFILE}' in region '{REGION}'")
except Exception as e:
    logging.warning(f"Failed to initialize Boto3 session with profile: {e}")
    logging.info("Falling back to without profile...")
    try:
        # session = boto3.Session(region_name=REGION)
        # cloudformation = session.client("cloudformation")
        # cloudwatch = session.client("cloudwatch")
        cloudformation = boto3.client("cloudformation", region_name=REGION)
        cloudwatch = boto3.client("cloudwatch", region_name=REGION)
        logging.info(f"Using region '{REGION}' without profile")
    except Exception as e:
        logging.error(f"Failed to initialize Boto3 session without profile: {e}")
        raise


def get_stacks() -> list[str]:
    """
    List all CloudFormation stacks except 'DELETED_STACKS' and match the regex pattern.
    Ignore nested stacks.
    """
    regex_pattern = "(?i)^(engine|frontend|infra)Env.*"

    response = cloudformation.list_stacks(
        StackStatusFilter=[
            "CREATE_IN_PROGRESS",
            "CREATE_FAILED",
            "CREATE_COMPLETE",
            "ROLLBACK_IN_PROGRESS",
            "ROLLBACK_FAILED",
            "ROLLBACK_COMPLETE",
            "DELETE_IN_PROGRESS",
            "DELETE_FAILED",
            "UPDATE_IN_PROGRESS",
            "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
            "UPDATE_COMPLETE",
            "UPDATE_FAILED",
            "UPDATE_ROLLBACK_IN_PROGRESS",
            "UPDATE_ROLLBACK_FAILED",
            "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
            "UPDATE_ROLLBACK_COMPLETE",
            "REVIEW_IN_PROGRESS",
            "IMPORT_IN_PROGRESS",
            "IMPORT_COMPLETE",
            "IMPORT_ROLLBACK_IN_PROGRESS",
            "IMPORT_ROLLBACK_FAILED",
            "IMPORT_ROLLBACK_COMPLETE",
        ]
    )
    matching_stacks = []
    for cfn_stack in response["StackSummaries"]:
        stack_name = cfn_stack["StackName"]
        match = re.search(regex_pattern, stack_name)
        if match and "ParentId" not in cfn_stack:
            matching_stacks.append(stack_name)
    return matching_stacks


def create_widget(stack_name: str) -> dict:
    """
    Create a CloudWatch text widget for a given stack, including the 'GitVersion' tag.
    """
    stack_details = cloudformation.describe_stacks(StackName=stack_name)

    # Add debug logs to inspect stack_details
    logging.debug(f"Stack details for {stack_name}: {stack_details}")

    git_version_tag = next(
        (
            tag["Value"]
            for tag in stack_details["Stacks"][0]["Tags"]
            if tag["Key"] == "GitVersion"
        ),
        "N/A",
    )

    # Add debug logs to inspect git_version_tag
    logging.debug(f"GitVersion tag for {stack_name}: {git_version_tag}")

    stack_status = stack_details["Stacks"][0]["StackStatus"]

    stack_url = f"https://{REGION}.console.aws.amazon.com/cloudformation/home?region={REGION}#/stacks/stackinfo?stackId={stack_details['Stacks'][0]['StackId']}"
    code_url = f"https://github.com/clbt-10daa690/Titan/{"tree/" + git_version_tag if git_version_tag != 'N/A' else ''}"

    html_string = f"""
    <h1>{stack_name}</h1><br>
    ---
    <b>GitVersion:</b> {git_version_tag}<br>
    <b>Status:</b> {stack_status}<br>
    [button:Go to Stack]({stack_url})[button:Go to Code]({code_url})
    """
    markdown_string = markdownify(html_string)

    widget = {
        "type": "text",
        "x": 0,
        "y": 0,
        "width": 6,
        "height": 6,
        "properties": {"markdown": markdown_string},
    }

    # Add debug logs to inspect widget
    logging.debug(f"Widget for {stack_name}: {widget}")

    return widget


def delete_stack(stack_name: str) -> bool:
    """
    Delete a given CloudFormation stack.
    """
    try:
        cloudformation.delete_stack(StackName=stack_name)
        logging.info(f"Deleted stack: {stack_name}")
        return True
    except Exception as e:
        logging.error(f"Error deleting stack {stack_name}: {e}")
        return False


def put_dashboard(dashboard_name: str, dashboard_body: dict) -> None:
    """
    Create a CloudWatch dashboard with the given name and body.
    """
    cloudwatch.put_dashboard(
        DashboardName=dashboard_name, DashboardBody=json.dumps(dashboard_body)
    )
    logging.info(f"Created CloudWatch dashboard: {dashboard_name}")


def organize_widgets(widgets):
    """
    Organize widgets to fit the screen width with 2 widgets per row.
    """
    for i, widget in enumerate(widgets):
        widget["x"] = (i % 4) * 6
        widget["y"] = (i // 4) * 6
    return widgets


def main(event):
    logging.info(f"Event: {event}")
    payload = event.get("cleanup", "false")
    if payload == "true":
        matching_stacks = get_stacks()
        for stack_name in matching_stacks:
            if "prod" not in stack_name.lower():
                delete_stack(stack_name)
        matching_stacks = get_stacks()
    else:
        matching_stacks = get_stacks()

    # Add debug logs to inspect matching_stacks
    logging.debug(f"Matching stacks: {matching_stacks}")

    widgets = [create_widget(stack_name) for stack_name in matching_stacks]

    # Organize widgets to fit the screen width with 2 widgets per row
    organized_widgets = organize_widgets(widgets)

    dashboard_body = {"widgets": organized_widgets}

    # Add debug logs to inspect dashboard_body
    logging.debug(f"Dashboard body: {dashboard_body}")

    put_dashboard("TitanStacksDashboard", dashboard_body)
    logging.info("Finished execution")
    return {"statusCode": 200, "body": "Dashboard created successfully"}


def handler(event, context):
    return main(event)
