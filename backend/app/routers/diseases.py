from fastapi import APIRouter, Query

from app.deps import AnyAuthUser
from app.services.icd10_service import icd10_service
from app.services.ml_service import ml_service

router = APIRouter(prefix="/diseases", tags=["diseases"])


@router.get("/autocomplete")
def autocomplete(
    _: AnyAuthUser,
    q: str = Query("", max_length=120),
    limit: int = Query(20, ge=1, le=50),
):
    ml_service.load()
    icd10_service.load()
    items = ml_service.disease_suggestions(q, limit)
    return [icd10_service.enrich_disease(x["name"]) for x in items]
