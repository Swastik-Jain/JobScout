import logging
import sys

def setup_logging(level: int = logging.INFO) -> None:
    """Configures structured application-wide logging."""
    root_logger = logging.getLogger()
    if root_logger.handlers:
        return  # already configured

    root_logger.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

def get_logger(name: str = "jobscout") -> logging.Logger:
    """Returns a named logger configured for JobScout."""
    return logging.getLogger(name)
