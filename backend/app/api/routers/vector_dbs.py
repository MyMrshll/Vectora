from fastapi import APIRouter, HTTPException, status
from typing import List
from app.models.schemas import VectorDBCreate, VectorDBResponse, CollectionCreate
from app.services.vector_db_service import VectorDBService
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter()

class ConnectionTestRequest(BaseModel):
    provider: str
    url: Optional[str] = None
    api_key: Optional[str] = None

class ConnectionTestResponse(BaseModel):
    success: bool
    message: str

@router.get("/", response_model=List[VectorDBResponse])
async def list_vector_dbs():
    """List all registered vector database configurations."""
    try:
        return await VectorDBService.list_dbs()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list vector databases: {str(e)}"
        )

@router.post("/", response_model=VectorDBResponse, status_code=status.HTTP_201_CREATED)
async def create_vector_db(db_data: VectorDBCreate):
    """Register a new vector database cluster connection."""
    try:
        return await VectorDBService.create_db(db_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create vector database configuration: {str(e)}"
        )

@router.delete("/{db_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vector_db(db_id: str):
    """Delete a vector database connection registry."""
    success = await VectorDBService.delete_db(db_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vector database configuration '{db_id}' not found or could not be deleted."
        )

@router.post("/{db_id}/activate", response_model=VectorDBResponse)
async def activate_vector_db(db_id: str):
    """Switch the system to use the selected vector database engine."""
    try:
        return await VectorDBService.activate_db(db_id)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except RuntimeError as re:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(re)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate vector database: {str(e)}"
        )

@router.post("/test-connection", response_model=ConnectionTestResponse)
async def test_vector_db_connection(req: ConnectionTestRequest):
    """Test connection to a vector database cluster before saving details."""
    success = await VectorDBService.test_connection(
        provider=req.provider,
        url=req.url,
        api_key=req.api_key
    )
    if success:
        return ConnectionTestResponse(
            success=True,
            message=f"Successfully connected to {req.provider}!"
        )
    else:
        return ConnectionTestResponse(
            success=False,
            message=f"Failed to establish connection to {req.provider}. Please verify URL and credentials."
        )

@router.get("/{db_id}/collections", response_model=List[str])
async def list_db_collections(db_id: str):
    """List all collections inside the specified vector database cluster."""
    try:
        return await VectorDBService.list_collections(db_id)
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list collections: {str(e)}"
        )

@router.post("/{db_id}/collections", status_code=status.HTTP_201_CREATED)
async def create_db_collection(db_id: str, payload: CollectionCreate):
    """Create a new collection inside the specified vector database cluster."""
    try:
        success = await VectorDBService.create_collection(db_id, payload.name)
        return {"success": success, "message": f"Collection '{payload.name}' successfully created."}
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create collection: {str(e)}"
        )

@router.post("/{db_id}/collections/{collection_name}/activate")
async def activate_db_collection(db_id: str, collection_name: str):
    """Set the specified collection as the active target for the database cluster."""
    try:
        updated_db = await VectorDBService.activate_collection(db_id, collection_name)
        return {
            "success": True, 
            "message": f"Collection '{collection_name}' is now activated.",
            "data": updated_db
        }
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate collection: {str(e)}"
        )
