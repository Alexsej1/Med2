from fastapi import APIRouter, Depends, Query

from app.deps import AnyAuthUser
from app.services.ml_service import ml_service

router = APIRouter(prefix="/symptoms", tags=["symptoms"])


@router.get("/labels", response_model=dict[str, str])
def symptom_labels(_: AnyAuthUser):
    ml_service.load()
    return ml_service.symptom_labels_map()


@router.get("/autocomplete")
def autocomplete(
    _: AnyAuthUser,
    q: str = Query("", max_length=120),
    limit: int = Query(20, ge=1, le=50),
):
    ml_service.load()
    return ml_service.symptom_suggestions(q, limit)
