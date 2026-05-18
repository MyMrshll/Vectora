from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from app.services.document_service import document_service
from app.models.schemas import DocumentResponse
from typing import List

router = APIRouter()

@router.post("/", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    # Check supported extensions
    allowed_extensions = ["txt", "pdf", "docx", "md", "markdown"]
    file_ext = file.filename.split(".")[-1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed formats: {', '.join(allowed_extensions)}"
        )
        
    try:
        doc = await document_service.upload_document(file, background_tasks)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[DocumentResponse])
async def get_documents():
    try:
        docs = await document_service.get_documents()
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str):
    doc = await document_service.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    success = await document_service.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or delete failed")
    return {"message": "Document and associated chunks/vectors deleted successfully"}
