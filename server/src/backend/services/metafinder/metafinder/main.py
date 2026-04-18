import uvicorn

from operations.app import app


def run_app():
    uvicorn.run(app, port=8000)


if __name__ == "__main__":
    run_app()
