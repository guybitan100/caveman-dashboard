import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers.main import router
from api.routers.draft_api import draft_router
from core.config import SETTINGS


app = FastAPI()

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=origins,
    allow_headers=origins,
)
app.include_router(router)
app.include_router(draft_router)


@app.get("/")
def get_index():
    return "Hello, welcome to Titan!"


def run_manager_server():
    uvicorn.run(app, port=SETTINGS.API_PORT, host='0.0.0.0')
