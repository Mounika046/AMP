from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "L1 HelpDesk Agent MVP"
    database_url: str = "sqlite:///./helpdesk_mvp.db"
    use_local_ai: bool = False
    local_storage_dir: str = "./tmp"

    oci_config_file: str = "~/.oci/config"
    oci_profile: str = "DEFAULT"
    oci_config_profile: str | None = None
    oci_region: str | None = None
    oci_genai_region: str | None = None
    oci_genai_project_ocid: str | None = None
    oci_compartment_id: str | None = None
    oci_genai_endpoint: str | None = None
    oci_genai_model: str | None = None
    oci_responses_model_id: str = "openai.gpt-oss-120b"
    oci_file_search_model: str = "google.gemini-2.5-flash"
    oci_object_storage_bucket: str | None = None
    oci_object_storage_namespace: str | None = None
    oci_vector_store_id: str | None = None
    oci_vector_store_chunk_size: int = 1000
    oci_vector_store_chunk_overlap: int = 200
    oci_vector_store_max_wait_seconds: int = 900
    zendesk_subdomain: str | None = None
    zendesk_email: str | None = None
    zendesk_api_token: str | None = None
    zendesk_default_requester_name: str = "L1 HelpDesk User"
    zendesk_default_requester_email: str | None = None
    zendesk_group_id: str | None = None
    zendesk_tags: str = "l1-helpdesk-agent,oci-ai"

    @property
    def resolved_oci_region(self) -> str | None:
        return self.oci_genai_region or self.oci_region

    @property
    def resolved_oci_profile(self) -> str:
        return self.oci_config_profile or self.oci_profile

    @property
    def resolved_chat_model(self) -> str:
        return self.oci_genai_model or self.oci_responses_model_id


def validate_oci_configuration(settings: Settings) -> None:
    if settings.use_local_ai:
        raise RuntimeError("USE_LOCAL_AI must be false. This MVP is configured for OCI-only execution.")

    required = {
        "OCI_REGION or OCI_GENAI_REGION": settings.resolved_oci_region,
        "OCI_GENAI_PROJECT_OCID": settings.oci_genai_project_ocid,
        "OCI_COMPARTMENT_ID": settings.oci_compartment_id,
        "OCI_GENAI_MODEL or OCI_RESPONSES_MODEL_ID": settings.resolved_chat_model,
        "OCI_FILE_SEARCH_MODEL": settings.oci_file_search_model,
        "OCI_VECTOR_STORE_ID": settings.oci_vector_store_id,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required OCI environment variables: {', '.join(missing)}")

    config_path = Path(settings.oci_config_file).expanduser()
    if not config_path.exists():
        raise RuntimeError(f"OCI config file not found: {config_path}")


def validate_zendesk_configuration(settings: Settings) -> None:
    required = {
        "ZENDESK_SUBDOMAIN": settings.zendesk_subdomain,
        "ZENDESK_EMAIL": settings.zendesk_email,
        "ZENDESK_API_TOKEN": settings.zendesk_api_token,
        "ZENDESK_DEFAULT_REQUESTER_EMAIL": settings.zendesk_default_requester_email,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required Zendesk environment variables: {', '.join(missing)}")


@lru_cache
def get_settings() -> Settings:
    return Settings()
