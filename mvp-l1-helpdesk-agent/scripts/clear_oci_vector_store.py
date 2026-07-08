"""
Delete every file entry from an OCI Generative AI Vector Store.

This is intentionally standalone: it does not import the FastAPI app. By default
it loads backend/.env, uses the same OCI OpenAI-compatible auth packages as the
MVP, lists files in the vector store, and runs in dry-run mode.

Examples:
  python scripts/clear_oci_vector_store.py --vector-store-id ocid1...
  python scripts/clear_oci_vector_store.py --vector-store-id ocid1... --yes
  python scripts/clear_oci_vector_store.py --vector-store-id ocid1... --yes --delete-underlying-files
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from openai import OpenAI

try:
    from oci_genai_auth import OciUserPrincipalAuth
except ImportError:
    from oci_openai import OciUserPrincipalAuth


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = ROOT_DIR / "backend" / ".env"


def env_value(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


def require_env(name: str, value: str | None) -> str:
    if not value:
        raise SystemExit(f"Missing required environment value: {name}")
    return value


def build_client(env_file: Path) -> OpenAI:
    if env_file.exists():
        load_dotenv(env_file)

    region = require_env("OCI_GENAI_REGION or OCI_REGION", env_value("OCI_GENAI_REGION", "OCI_REGION"))
    compartment_id = require_env("OCI_COMPARTMENT_ID", env_value("OCI_COMPARTMENT_ID"))
    project_ocid = require_env("OCI_GENAI_PROJECT_OCID", env_value("OCI_GENAI_PROJECT_OCID"))
    config_file = env_value("OCI_CONFIG_FILE", default="~/.oci/config")
    profile_name = env_value("OCI_CONFIG_PROFILE", "OCI_PROFILE", default="DEFAULT")

    auth = OciUserPrincipalAuth(
        config_file=str(Path(config_file).expanduser()),
        profile_name=profile_name,
    )
    base_url = f"https://inference.generativeai.{region}.oci.oraclecloud.com/openai/v1"
    return OpenAI(
        api_key="not-used",
        base_url=base_url,
        project=project_ocid,
        default_headers={"opc-compartment-id": compartment_id},
        http_client=httpx.Client(auth=auth, timeout=60),
    )


def item_id(item: Any) -> str:
    file_id = getattr(item, "id", None)
    if file_id:
        return str(file_id)
    if isinstance(item, dict) and item.get("id"):
        return str(item["id"])
    raise RuntimeError(f"Could not read file id from vector store file item: {item!r}")


def list_vector_store_file_ids(client: OpenAI, vector_store_id: str) -> list[str]:
    file_ids: list[str] = []
    after: str | None = None

    while True:
        kwargs: dict[str, Any] = {"vector_store_id": vector_store_id, "limit": 100}
        if after:
            kwargs["after"] = after

        page = client.vector_stores.files.list(**kwargs)
        page_items = list(getattr(page, "data", []) or [])
        file_ids.extend(item_id(item) for item in page_items)

        has_more = bool(getattr(page, "has_more", False))
        if not has_more or not page_items:
            break
        after = item_id(page_items[-1])

    return file_ids


def delete_vector_store_files(
    client: OpenAI,
    vector_store_id: str,
    file_ids: list[str],
    delete_underlying_files: bool,
) -> None:
    for index, file_id in enumerate(file_ids, start=1):
        print(f"[{index}/{len(file_ids)}] Removing from vector store: {file_id}")
        client.vector_stores.files.delete(vector_store_id=vector_store_id, file_id=file_id)

        if delete_underlying_files:
            print(f"       Deleting uploaded File object: {file_id}")
            client.files.delete(file_id)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Delete all files from an OCI Vector Store.")
    parser.add_argument(
        "--vector-store-id",
        default=env_value("OCI_VECTOR_STORE_ID"),
        help="Vector store ID. Defaults to OCI_VECTOR_STORE_ID from backend/.env or environment.",
    )
    parser.add_argument(
        "--env-file",
        default=str(DEFAULT_ENV_FILE),
        help="Path to .env file. Defaults to backend/.env.",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Actually delete files. Without this flag the script only prints what would be deleted.",
    )
    parser.add_argument(
        "--delete-underlying-files",
        action="store_true",
        help="Also delete the uploaded File objects after removing them from the vector store.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    env_file = Path(args.env_file).expanduser().resolve()
    client = build_client(env_file)
    vector_store_id = require_env(
        "OCI_VECTOR_STORE_ID or --vector-store-id",
        args.vector_store_id or env_value("OCI_VECTOR_STORE_ID"),
    )

    file_ids = list_vector_store_file_ids(client, vector_store_id)
    print(f"Vector store: {vector_store_id}")
    print(f"Files found: {len(file_ids)}")

    if not file_ids:
        return

    for file_id in file_ids:
        print(f"  - {file_id}")

    if not args.yes:
        print("\nDry run only. Re-run with --yes to delete these vector store file entries.")
        return

    delete_vector_store_files(
        client=client,
        vector_store_id=vector_store_id,
        file_ids=file_ids,
        delete_underlying_files=args.delete_underlying_files,
    )
    print("Done.")


if __name__ == "__main__":
    main()
