from core.config import SETTINGS
from metafinder_core.clients.athena import AthenaClient


def get_athena_client() -> AthenaClient:
	return AthenaClient(
		database_name=SETTINGS.METAFINDER_ATHENA_DATABASE_NAME,
		output_location=SETTINGS.METAFINDER_ATHENA_OUTPUT_LOCATION,
		aws_region=SETTINGS.AWS_REGION
	)