from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)

from knowledgesystem.data import AbstractDocumentStore
from knowledgesystem.dependencies import get_document_store, get_labeler
from knowledgesystem.logic import AbstractLabeler
from knowledgesystem.models.response import Document, DocumentCreate

router = APIRouter(tags=["knowledge"])


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload(
    name: Annotated[str, Form()],
    file_upload: Annotated[UploadFile, File()],
    document_store: Annotated[AbstractDocumentStore, Depends(get_document_store)],
    labeler: Annotated[AbstractLabeler, Depends(get_labeler)],
) -> None:
    content = await file_upload.read()
    match file_upload.content_type:
        case "text/plain":
            metadata = await labeler.label_text(content.decode(), name)
        case "image/png" | "image/jpeg" | "image/webp":
            metadata = await labeler.label_image(
                content, file_upload.content_type, name
            )
        case _:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    document = DocumentCreate(
        name=name,
        content=content,
        content_type=file_upload.content_type,
        description=metadata.description,
        tags=metadata.tags,
    )
    await document_store.add_document(document)


@router.get("/search", response_model=list[Document])
async def search(
    term: str,
    document_store: Annotated[AbstractDocumentStore, Depends(get_document_store)],
) -> list[Document]:
    return await document_store.search_documents(term)


@router.get("/delete")
async def delete(
    document_id: int,
    document_store: Annotated[AbstractDocumentStore, Depends(get_document_store)],
) -> None:
    await document_store.delete_document(document_id)


@router.get("/view", response_model=Document)
async def view(
    document_id: int,
    document_store: Annotated[AbstractDocumentStore, Depends(get_document_store)],
) -> Document:
    return await document_store.get_document_by_id(document_id)


@router.get("/list", response_model=list[Document])
async def list_items(
    document_store: Annotated[AbstractDocumentStore, Depends(get_document_store)],
) -> list[Document]:
    return await document_store.get_all_documents()
