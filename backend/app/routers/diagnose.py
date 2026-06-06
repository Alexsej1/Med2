from fastapi import APIRouter, Depends

from app.deps import AnyAuthUser
from app.schemas import DiagnoseRequest, DiagnoseResponse, DiagnosisItem
from app.services.icd10_service import icd10_service
from app.services.ml_service import ml_service

router = APIRouter(prefix="/diagnose", tags=["diagnose"])


@router.post("", response_model=DiagnoseResponse)
def diagnose(_: AnyAuthUser, body: DiagnoseRequest):
    ml_service.load()
    preds, needs, questions, max_p = ml_service.predict(body.symptom_keys, body.clarifications)
    icd10_service.load()
    enriched_preds = []
    for p in preds:
        item = dict(p)
        disease = item.get("disease")
        if isinstance(disease, str):
            icd = icd10_service.lookup(disease)
            if icd:
                item["icd10_code"] = icd["code"]
                if icd.get("title_ru"):
                    item["icd10_title_ru"] = icd["title_ru"]
                if icd.get("title_en"):
                    item["icd10_title_en"] = icd["title_en"]
        enriched_preds.append(item)
    items = [DiagnosisItem(**p) for p in enriched_preds]
    return DiagnoseResponse(
        predictions=items,
        needs_clarification=needs,
        clarifying_questions=questions,
        max_probability=round(max_p, 4),
    )
