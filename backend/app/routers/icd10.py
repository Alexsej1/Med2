from fastapi import APIRouter, Query

from app.deps import AnyAuthUser
from app.services.icd10_service import icd10_service

router = APIRouter(prefix="/icd10", tags=["icd10"])


@router.get("/lookup")
def lookup(_: AnyAuthUser, disease: str = Query(..., min_length=1, max_length=200)):
    icd10_service.load()
    entry = icd10_service.lookup(disease)
    if not entry:
        return {"found": False}
    return {"found": True, "disease": disease.strip(), **entry}


@router.get("/search")
def search(
    _: AnyAuthUser,
    q: str = Query("", max_length=120),
    limit: int = Query(20, ge=1, le=50),
):
    icd10_service.load()
    return icd10_service.search(q, limit)
