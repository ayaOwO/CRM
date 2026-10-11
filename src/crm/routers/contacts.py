from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contact() -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.get("")
async def list_contacts() -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.get("/{id}")
async def get_contact(id: int) -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.put("/{id}")
async def replace_contact(id: int) -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.patch("/{id}")
async def update_contact(id: int) -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(id: int) -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)
