"""PDF text extraction for pitch decks. Add pypdf or PyPDF2 to requirements if needed."""

import os


def extract_text_from_pdf(filepath: str) -> str:
    """Extract text from a PDF file. Returns raw text string."""
    try:
        import pypdf
        reader = pypdf.PdfReader(filepath)
        parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
        return "\n\n".join(parts) if parts else ""
    except ImportError:
        try:
            import PyPDF2
            with open(filepath, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                parts = []
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        parts.append(text)
                return "\n\n".join(parts) if parts else ""
        except ImportError:
            return ""


def extract_text_from_upload(content: bytes, filename: str) -> str:
    """Extract text from uploaded file content. Saves to temp file if PDF."""
    if not filename.lower().endswith(".pdf"):
        return content.decode("utf-8", errors="replace")
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        return extract_text_from_pdf(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
