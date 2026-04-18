import typer
from core.titan_logger import logger

from titan_db.jobs.models import create_tables, delete_tables
from api.app import run_manager_server

cli = typer.Typer()


@cli.command(name='run-server')
def run_server():
    logger.info('Starting Server...')
    run_manager_server()


@cli.command(name='init-db')
def init_db():
    logger.info('Database is Initialized')
    create_tables()


@cli.command(name='drop-db')
def drop_database():
    logger.info('Database is Dropped')
    delete_tables()
    


if __name__ == '__main__':
    cli()
