from mangum import Mangum

from metafinder.operations.app import app

app_handler = Mangum(app)