from fastapi import FastAPI, Depends
from starlette.middleware.cors import CORSMiddleware

from core import routes
from metafinder.dependencies import get_athena_client
from metafinder.operations import operations
from metafinder.models.requests import GetRequest, GetDataRequest
from metafinder_core.clients.athena import AthenaClient
from model.metafinder.data_types import DataType, KeywordTerms, RangeTerms

app = FastAPI()

app.add_middleware(CORSMiddleware,
                   allow_origins=["*"],
                   allow_credentials=True,
                   allow_methods=["*"],
                   allow_headers=["*"], )


@app.get(routes.BASE)
def health_check():
    return "Metafinder is running"


@app.post(routes.DATA)
def get_data(request: GetDataRequest):
    return operations.get_data(request)


@app.post(routes.COUNT, response_model=int)
def get_count(request: GetRequest, athena_client: AthenaClient = Depends(get_athena_client)):
    return operations.get_count(request, client=athena_client)


@app.post(f'{routes.COUNT}{routes.DATA_TYPE}{routes.TERM_PREFIX}{routes.TERM}', response_model=dict[str, dict])
def get_term_count(data_type: DataType, term: KeywordTerms, athena_client: AthenaClient = Depends(get_athena_client)):
    return operations.get_term_count(data_type, term, client=athena_client)


@app.post(f'{routes.AVERAGE}{routes.DATA_TYPE}{routes.TERM_PREFIX}{routes.TERM}', response_model=dict[str, int])
def get_term_avg(data_type: DataType, term: RangeTerms, athena_client: AthenaClient = Depends(get_athena_client)):
    return operations.get_term_avg(data_type, term, client=athena_client)


@app.post(f'{routes.COUNT}{routes.DATA_TYPE}{routes.TERM_PREFIX}{routes.OPTIONS_TERM}{routes.RANGE}{routes.RANGE_TERM}', response_model=dict[str, dict[str, int]])
def get_range_of_term_options(data_type: DataType, options_term: KeywordTerms, range_term: RangeTerms, athena_client: AthenaClient = Depends(get_athena_client)):
    return operations.get_term_options_range(data_type, options_term, range_term, client=athena_client)
