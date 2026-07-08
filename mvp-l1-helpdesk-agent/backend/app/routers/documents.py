from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Citation, Document, DocumentChunk
from app.schemas import DocumentOut
from app.services import settings_service
from app.services.oci import OCIServiceFacade
from app.services.storage import UploadStagingService
from app.services.text import chunk_text, extract_text

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_SUFFIXES = {".pdf", ".docx", ".txt"}


def to_out(document: Document) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        name=document.name,
        category=document.category,
        status=document.status,
        chunks=len(document.chunks),
        vector_store_file_id=document.vector_store_file_id,
        vector_store_batch_id=document.vector_store_batch_id,
        error=document.error,
        created_at=document.created_at,
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)) -> list[DocumentOut]:
    documents = db.execute(select(Document).order_by(Document.created_at.desc())).scalars().all()
    return [to_out(document) for document in documents]


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> DocumentOut:
    known_category = db.execute(select(Category).where(Category.name == category)).scalar_one_or_none()
    if known_category is None:
        raise HTTPException(status_code=400, detail="Choose one of the configured knowledge categories.")

    suffix = "." + (file.filename or "").split(".")[-1].lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT uploads are supported.")

    staging = UploadStagingService()
    local_path = await staging.save_upload(file)
    document_id = uuid4().hex
    document = Document(
        id=document_id,
        name=file.filename or "Uploaded document",
        category=category,
        status="Processing",
        object_key=f"vector-store-only/{document_id}/{file.filename or 'Uploaded document'}",
    )
    db.add(document)
    db.flush()

    try:
        vector_upload = OCIServiceFacade().upload_to_vector_store(
            local_path,
            chunk_size=settings_service.as_int("chunk_size", db, 400),
            chunk_overlap=settings_service.as_int("chunk_overlap", db, 50),
            category=category,
        )
        document.vector_store_file_id = vector_upload.file_id
        document.vector_store_batch_id = vector_upload.batch_id
        try:
            pages = extract_text(local_path)
            chunks = chunk_text(pages)
            for index, (page_number, text, token_count) in enumerate(chunks):
                db.add(
                    DocumentChunk(
                        id=uuid4().hex,
                        document_id=document.id,
                        page_number=page_number,
                        chunk_index=index,
                        token_count=token_count,
                        text=text,
                        vector_ref=f"oci-vector-store:{vector_upload.file_id}:{vector_upload.batch_id}:{index}",
                    )
                )
            document.error = None
        except Exception as metadata_error:
            document.error = f"Indexed in OCI Vector Store, but local preview extraction failed: {metadata_error}"
        document.status = "Indexed" if vector_upload.status == "completed" else "Processing"
    except Exception as error:  # pragma: no cover - visible in API response
        document.status = "Failed"
        document.error = str(error)

    document.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(document)
    local_path.unlink(missing_ok=True)
    return to_out(document)


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)) -> dict[str, str | bool]:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.vector_store_file_id:
        try:
            OCIServiceFacade().delete_vector_store_file(document.vector_store_file_id)
        except Exception as error:  # pragma: no cover - depends on OCI service response
            raise HTTPException(
                status_code=502,
                detail=f"Could not delete file from OCI Vector Store: {error}",
            ) from error

    db.execute(delete(Citation).where(Citation.document_id == document.id))
    db.delete(document)
    db.commit()
    return {"deleted": True, "id": document_id}
