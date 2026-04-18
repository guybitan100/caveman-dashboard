import sys

from loguru import logger

__version__ = "0.1.0"

logger.remove()
logger.add(
    sys.stdout,
    level="INFO",
    format="<blue>{time:HH:mm}</blue> <green>[{level}]</green> {message}",
    colorize=True,
)
