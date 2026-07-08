from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.config import get_settings


class UploadStagingService:
    """Stores an upload temporarily so it can be sent to OCI Vector Store."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.tmp_root = Path(self.settings.local_storage_dir)
        self.tmp_root.mkdir(parents=True, exist_ok=True)

    async def save_upload(self, file: UploadFile) -> Path:
        safe_name = Path(file.filename or "upload.bin").name
        local_path = self.tmp_root / "uploads" / f"{uuid4().hex}-{safe_name}"
        content = await file.read()

        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(content)
        return local_path
