from pathlib import Path

from docx import Document as DocxDocument
from pypdf import PdfReader


def extract_text(path: Path) -> list[tuple[int, str]]:
    suffix = path.suffix.lower()
    if suffix == ".txt":
        return [(1, path.read_text(encoding="utf-8", errors="ignore"))]

    if suffix == ".pdf":
        reader = PdfReader(str(path))
        pages: list[tuple[int, str]] = []
        for index, page in enumerate(reader.pages, start=1):
            pages.append((index, page.extract_text() or ""))
        return pages

    if suffix == ".docx":
        doc = DocxDocument(str(path))
        text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
        return [(1, text)]

    raise ValueError("Only PDF, DOCX, and TXT files are supported.")


def chunk_text(pages: list[tuple[int, str]], chunk_size: int = 400, overlap: int = 50) -> list[tuple[int, str, int]]:
    chunks: list[tuple[int, str, int]] = []
    step = max(1, chunk_size - overlap)
    for page_number, text in pages:
        words = text.split()
        if not words:
            continue
        for index, start in enumerate(range(0, len(words), step)):
            chunk_words = words[start : start + chunk_size]
            if chunk_words:
                chunks.append((page_number, " ".join(chunk_words), len(chunk_words)))
    return chunks
