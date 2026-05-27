import os

DATABRICKS_HOST = os.getenv("DATABRICKS_HOST")
DATABRICKS_APP_NAME = os.getenv("DATABRICKS_APP_NAME")

def is_databricks_app() -> bool:
    return bool(DATABRICKS_APP_NAME and DATABRICKS_HOST)
