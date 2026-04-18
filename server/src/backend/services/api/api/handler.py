from mangum import Mangum

from api.app import app
from six_db.jobs.models import create_tables, delete_tables

app_handler = Mangum(app)


def startup_handler(event, context):
	create_tables()
	
	
def shutdown_handler(event, context):
	delete_tables()