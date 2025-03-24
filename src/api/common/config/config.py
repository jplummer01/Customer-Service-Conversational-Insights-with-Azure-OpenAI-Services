import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    def __init__(self):
        self.sqldb_database = os.getenv("SQLDB_DATABASE")
        self.sqldb_password = os.getenv("SQLDB_PASSWORD")
        self.sqldb_server = os.getenv("SQLDB_SERVER")
        self.sqldb_username = os.getenv("SQLDB_USERNAME")
        self.driver = "{ODBC Driver 17 for SQL Server}"
        self.mid_id = os.environ.get("SQLDB_USER_MID")

        self.azure_openai_endpoint = os.getenv("AZURE_OPEN_AI_ENDPOINT")
        self.azure_openai_deployment_model = os.getenv("AZURE_OPEN_AI_DEPLOYMENT_MODEL")
        self.azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        self.azure_openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION")
        self.azure_openai_resource = os.getenv("AZURE_OPENAI_RESOURCE")

        self.azure_ai_search_endpoint = os.getenv("AZURE_AI_SEARCH_ENDPOINT")
        self.azure_ai_search_api_key = os.getenv("AZURE_AI_SEARCH_API_KEY")
        self.azure_ai_search_index = os.getenv("AZURE_AI_SEARCH_INDEX")

        self.use_ai_project_client = os.environ.get("USE_AI_PROJECT_CLIENT", "False").lower() == "true"
        self.azure_ai_project_conn_string = os.environ.get("AZURE_AI_PROJECT_CONN_STRING")

        self.use_chat_history_enabled = os.getenv("USE_CHAT_HISTORY_ENABLED", "false").strip().lower() == "true"
        self.azure_cosmosdb_database = os.getenv("AZURE_COSMOSDB_DATABASE")
        self.azure_cosmosdb_account = os.getenv("AZURE_COSMOSDB_ACCOUNT")
        self.azure_cosmosdb_conversations_container = os.getenv("AZURE_COSMOSDB_CONVERSATIONS_CONTAINER")
        self.azure_cosmosdb_account_key = os.getenv("AZURE_COSMOSDB_ACCOUNT_KEY")
        self.azure_cosmosdb_enable_feedback = os.getenv("AZURE_COSMOSDB_ENABLE_FEEDBACK", "false").lower() == "true"
