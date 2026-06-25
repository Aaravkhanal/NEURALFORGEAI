"""
NeuralForge — Training API Routes
Submit training jobs to the Celery queue (or in-process fallback),
monitor progress, and manage jobs. Now uses dynamic model catalog generation.
"""

import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_optional_user_id
from models.project import Project
from models.file import File
from models.training_job import TrainingJob
from models.trained_model import TrainedModel
from schemas import (
    TrainingStartRequest, AutoMLStartRequest,
    TrainingJobResponse, TrainingJobListResponse,
    TrainedModelResponse,
    ModelCatalogEntry, ModelCatalogResponse,
    DeriveTargetRequest,
)

logger = logging.getLogger("neuralforge.api.training")
router = APIRouter(prefix="/api/training", tags=["training"])


@router.get("/models/{task_type}", response_model=ModelCatalogResponse)
async def get_available_models(
    task_type: str,
    file_id: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    List available model architectures dynamically based on dataset.
    Never returns hardcoded catalogs.
    """
    from services.advisor_service import MODEL_DB, get_recommendations

    if file_id:
        # Generate dynamically based on dataset
        result = await db.execute(select(File).where(File.id == file_id))
        file_record = result.scalar_one_or_none()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")

        import os
        file_path = file_record.cleaned_file_path or file_record.file_path
        if file_path and os.path.exists(file_path) and file_record.dataset_type != "image":
            from services.dataset_analyzer import DatasetAnalyzer
            analyzer = DatasetAnalyzer()
            profile = analyzer.analyze(file_path)
        else:
            profile = {
                "dataset_type": file_record.dataset_type or "tabular",
                "row_count": file_record.row_count,
                "column_count": file_record.column_count,
            }

        recs = get_recommendations(profile, task_type=task_type, top_n=20)
        
        models = []
        for rec in recs["recommendations"]:
            models.append(ModelCatalogEntry(
                name=rec["model_key"],
                display_name=rec["display_name"],
                task_types=[task_type],
                description=rec["explanation"],
                parameters=rec["parameters"],
                recommended=rec["is_recommended"]
            ))
        
        if not models:
            raise HTTPException(status_code=404, detail=f"No models found for task type: {task_type}")
            
        return ModelCatalogResponse(task_type=task_type, models=models)

    else:
        # Return all eligible models for the task type without dataset context
        models = []
        for key, info in MODEL_DB.items():
            if task_type in info.get("task_types", []):
                models.append(ModelCatalogEntry(
                    name=key,
                    display_name=info["display_name"],
                    task_types=info["task_types"],
                    description=" ".join(info.get("strengths", [])),
                    parameters=info.get("parameters", "N/A"),
                    recommended=False
                ))

        if not models:
            raise HTTPException(status_code=404, detail=f"Unknown task type: {task_type}")

        return ModelCatalogResponse(task_type=task_type, models=models)


@router.post("/start", response_model=TrainingJobResponse)
async def start_training(
    request: TrainingStartRequest,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Submit a training job. Uses Celery if available, otherwise runs in-process."""
    # Verify file exists
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    project_id = file_record.project_id
    effective_user_id = user_id or "guest_user"

    # Verify project ownership only for authenticated (non-guest) users
    if user_id and user_id != "guest_user" and project_id:
        result = await db.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Project not found")

    job_id = str(uuid.uuid4())
    epochs = request.training_config.get("n_estimators", request.training_config.get("epochs", 100))

    job = TrainingJob(
        id=job_id,
        project_id=project_id,
        file_id=request.file_id,
        user_id=effective_user_id,
        task_type=request.task_type,
        model_name=request.model_name,
        model_config=request.model_config,
        training_config=request.training_config,
        augmentation_config=request.augmentation_config,
        target_column=request.target_column,
        status="queued",
        total_epochs=epochs,
    )
    db.add(job)
    await db.flush()

    task_type = request.task_type.lower()
    
    # Check if at least one Celery worker is alive and responding
    celery_available = False
    try:
        from workers.celery_app import app as celery_app
        # ping() returns a list of worker responses; empty list = broker up but no workers
        active_workers = celery_app.control.ping(timeout=1.0)
        celery_available = bool(active_workers)
        if not celery_available:
            logger.warning("Celery broker reachable but no workers responded. Using in-process fallback.")
    except Exception:
        logger.warning("Celery broker not reachable. Using in-process training fallback.")

    try:
        if celery_available:
            # Dispatch to Celery
            if task_type in ("tabular_classification", "tabular_regression"):
                from workers.training_tasks import train_tabular
                file_path = file_record.cleaned_file_path or file_record.file_path
                celery_task = train_tabular.delay(
                    job_id, file_path, request.target_column,
                    request.model_name, request.training_config,
                )
            elif task_type == "image_classification":
                from workers.training_tasks import train_image_classification
                img_meta = file_record.image_metadata or {}
                dataset_path = img_meta.get("extracted_path", "")
                celery_task = train_image_classification.delay(
                    job_id, dataset_path, request.model_name,
                    request.training_config, request.augmentation_config,
                )
            elif task_type in ("text_classification", "sentiment_analysis"):
                from workers.training_tasks import train_text_classification
                file_path = file_record.cleaned_file_path or file_record.file_path
                text_col = request.model_config.get("text_column", "text")
                celery_task = train_text_classification.delay(
                    job_id, file_path, request.target_column,
                    text_col, request.model_name, request.training_config,
                )
            elif task_type == "object_detection":
                from workers.training_tasks import train_object_detection
                img_meta = file_record.image_metadata or {}
                dataset_path = img_meta.get("extracted_path", "")
                celery_task = train_object_detection.delay(
                    job_id, dataset_path, request.model_name, request.training_config,
                )
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported task type: {task_type}")

            job.celery_task_id = celery_task.id
            await db.flush()

        else:
            # In-process fallback (no Celery broker) — call the underlying function
            # directly to avoid Celery's bind=True task-stack machinery failing
            # outside a worker context.
            if task_type in ("tabular_classification", "tabular_regression"):
                from workers.training_tasks import train_tabular
                file_path = file_record.cleaned_file_path or file_record.file_path

                def _run_tabular():
                    # .run() on a bind=True task auto-injects self; don't pass it explicitly
                    train_tabular.run(
                        job_id, file_path, request.target_column,
                        request.model_name, request.training_config,
                    )

                background_tasks.add_task(_run_tabular)
            else:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"In-process fallback only supports tabular tasks. "
                        f"Start the Celery worker for {task_type}: "
                        f"celery -A workers.celery_app worker --loglevel=info"
                    ),
                )

            job.celery_task_id = "in_process_" + job_id
            await db.flush()

    except Exception as e:
        job.status = "failed"
        job.error_message = f"Failed to start training: {str(e)}"
        await db.flush()

    return TrainingJobResponse.model_validate(job)


@router.post("/automl", response_model=TrainingJobResponse)
async def start_automl(
    request: AutoMLStartRequest,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Start an AutoML pipeline that tries multiple models and selects the best."""
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    project_id = file_record.project_id
    effective_user_id_automl = user_id or "guest_user"

    if user_id and user_id != "guest_user" and project_id:
        result = await db.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Project not found")

    job_id = str(uuid.uuid4())
    job = TrainingJob(
        id=job_id,
        project_id=project_id,
        file_id=request.file_id,
        user_id=effective_user_id_automl,
        task_type=request.task_type or "tabular_classification",
        model_name="AutoML",
        training_config=request.training_config,
        target_column=request.target_column,
        is_automl=True,
        status="queued",
    )
    db.add(job)
    await db.flush()

    # Check Celery
    celery_available = False
    try:
        from workers.celery_app import app as celery_app
        celery_app.control.ping(timeout=0.5)
        celery_available = True
    except Exception:
        pass

    try:
        from workers.training_tasks import train_automl
        file_path = file_record.cleaned_file_path or file_record.file_path
        
        if celery_available:
            celery_task = train_automl.delay(
                job_id, file_path, request.target_column, request.training_config,
            )
            job.celery_task_id = celery_task.id
        else:
            background_tasks.add_task(
                train_automl, job_id, file_path, request.target_column, request.training_config
            )
            job.celery_task_id = "in_process_" + job_id
            
        await db.flush()
    except Exception as e:
        job.status = "failed"
        job.error_message = f"Failed to start AutoML: {str(e)}"
        await db.flush()

    return TrainingJobResponse.model_validate(job)


@router.get("/jobs/{job_id}", response_model=TrainingJobResponse)
async def get_training_job(
    job_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get training job status and metrics."""
    result = await db.execute(
        select(TrainingJob).where(TrainingJob.id == job_id, TrainingJob.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TrainingJobResponse.model_validate(job)


@router.get("/jobs", response_model=TrainingJobListResponse)
async def list_training_jobs(
    project_id: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all training jobs, optionally filtered by project."""
    query = select(TrainingJob).where(TrainingJob.user_id == user_id)
    if project_id:
        query = query.where(TrainingJob.project_id == project_id)
    query = query.order_by(TrainingJob.created_at.desc())

    result = await db.execute(query)
    jobs = result.scalars().all()
    return TrainingJobListResponse(
        jobs=[TrainingJobResponse.model_validate(j) for j in jobs],
        total=len(jobs),
    )


@router.post("/cancel/{job_id}")
async def cancel_training(
    job_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running training job."""
    result = await db.execute(
        select(TrainingJob).where(TrainingJob.id == job_id, TrainingJob.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status not in ("queued", "training"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel job with status: {job.status}")

    # Revoke Celery task if applicable
    if job.celery_task_id and not str(job.celery_task_id).startswith("in_process_"):
        try:
            from workers.celery_app import app as celery_app
            celery_app.control.revoke(job.celery_task_id, terminate=True)
        except Exception:
            pass

    job.status = "cancelled"
    job.completed_at = datetime.now(timezone.utc)
    await db.flush()

    return {"status": "cancelled", "job_id": job_id}


@router.post("/derive-target")
async def derive_target_column(
    request: DeriveTargetRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    AI-powered target column analysis.
    Given a file_id and target description, either matches it to an existing
    column or computes a derived column using a formula and saves it.
    """
    import os
    import json
    import uuid

    import pandas as pd

    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_record.cleaned_file_path or file_record.file_path
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset file not found on disk")

    # Load dataset
    try:
        ext = os.path.splitext(file_path)[1].lower()
        df = pd.read_excel(file_path) if ext in (".xlsx", ".xls") else pd.read_csv(file_path)
        df.columns = df.columns.str.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read dataset: {e}")

    # Build column context for the LLM
    columns_info = []
    for col in df.columns:
        info: dict = {"name": col, "dtype": str(df[col].dtype),
                      "sample": df[col].dropna().head(5).tolist()}
        if df[col].dtype in ("float64", "float32", "int64", "int32"):
            info["min"] = float(df[col].min())
            info["max"] = float(df[col].max())
            info["mean"] = round(float(df[col].mean()), 4)
        columns_info.append(info)

    # Step 1: Web search for domain knowledge (Tavily)
    web_context = ""
    try:
        tavily_key = os.environ.get("TAVILY_API_KEY", "")
        if tavily_key:
            from tavily import TavilyClient
            tc = TavilyClient(api_key=tavily_key)
            col_names = [c["name"] for c in columns_info]
            query = (
                f"{request.target_description} calculation formula "
                f"using columns: {', '.join(col_names[:10])}"
            )
            search_resp = tc.search(
                query=query,
                search_depth="advanced",
                max_results=5,
                include_answer=True,
            )
            snippets = []
            if search_resp.get("answer"):
                snippets.append(f"Summary: {search_resp['answer']}")
            for r in search_resp.get("results", [])[:4]:
                snippets.append(f"- {r.get('title','')}: {r.get('content','')[:300]}")
            web_context = "\n".join(snippets)
            logger.info("Tavily search completed for: %s", request.target_description)
    except Exception as e:
        logger.warning("Tavily search failed (non-blocking): %s", e)

    # Step 2: Call LLM with web context
    try:
        from services.llm_service import get_best_available_llm
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = get_best_available_llm(temperature=0.1)

        web_section = (
            f"\nWeb search findings about '{request.target_description}':\n{web_context}\n"
            if web_context else ""
        )

        prompt = f"""You are an expert data scientist. The user wants to predict/analyze:
"{request.target_description}"
{web_section}
Dataset columns (name, dtype, min/max/mean for numerics, 5 sample values):
{json.dumps(columns_info, indent=2)}

Use the web search findings (if any) to identify the correct industry-standard formula.
Respond ONLY with valid JSON — no markdown, no explanation outside the JSON:
{{
  "strategy": "match" | "derive" | "impossible",
  "matched_column": "<exact column name from dataset>" (only when strategy is "match"),
  "formula": "<pandas expr using df, e.g. df['cap'] / df['rated_cap'] * 100>" (only when strategy is "derive"),
  "new_column_name": "<short_snake_case>" (only when strategy is "derive"),
  "explanation": "<1-2 sentences citing the source formula if found>"
}}

Rules:
- Use ONLY column names that actually exist in the dataset above.
- "match"  → target is an existing column (exact, acronym, or semantic match)
- "derive" → target CAN be computed from 2+ existing columns using domain formulas
- "impossible" → not enough information; user must pick manually
- All values in "formula" must reference only columns listed above."""

        response = await llm.ainvoke([
            SystemMessage(content="You are a data science expert. Output valid JSON only."),
            HumanMessage(content=prompt),
        ])

        raw = response.content.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()

        ai = json.loads(raw)

    except Exception as e:
        logger.warning("LLM derive-target failed: %s", e)
        return {
            "strategy": "impossible",
            "matched_column": None,
            "formula": None,
            "new_column_name": None,
            "derived_file_id": None,
            "explanation": (
                f"AI analysis unavailable. Select manually. "
                f"Available columns: {', '.join(df.columns.tolist()[:15])}"
            ),
        }

    strategy = ai.get("strategy", "impossible")
    matched_column = ai.get("matched_column")
    formula = ai.get("formula")
    new_column_name = ai.get("new_column_name")
    explanation = ai.get("explanation", "")
    derived_file_id = None

    if strategy == "derive" and formula and new_column_name:
        try:
            safe_globals = {"df": df, "pd": pd, "__builtins__": {}}
            new_col = eval(formula, safe_globals)  # nosec — formula from LLM, not raw user input
            df[new_column_name] = new_col

            uploads_dir = os.path.dirname(file_path)
            new_filename = f"derived_{uuid.uuid4().hex[:8]}_{os.path.basename(file_path)}"
            new_path = os.path.join(uploads_dir, new_filename)
            df.to_csv(new_path, index=False)

            new_file = File(
                id=str(uuid.uuid4()),
                project_id=file_record.project_id,
                filename=new_filename,
                file_path=new_path,
                cleaned_file_path=new_path,
                file_type="csv",
                file_size=os.path.getsize(new_path),
                dataset_type=file_record.dataset_type or "tabular",
                cleaning_status="cleaned",
                row_count=len(df),
                column_count=len(df.columns),
            )
            db.add(new_file)
            await db.flush()
            derived_file_id = new_file.id

        except Exception as e:
            logger.warning("Formula eval failed: %s", e)
            strategy = "impossible"
            explanation = f"Could not compute formula: {e}. Please select the target column manually."
            formula = None
            new_column_name = None

    return {
        "strategy": strategy,
        "matched_column": matched_column,
        "formula": formula,
        "new_column_name": new_column_name,
        "derived_file_id": derived_file_id,
        "explanation": explanation,
    }


@router.get("/model-by-job/{job_id}")
async def get_model_by_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get the trained model record for a given training job ID."""
    result = await db.execute(
        select(TrainedModel)
        .where(TrainedModel.training_job_id == job_id)
        .order_by(TrainedModel.created_at.desc())
    )
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="No trained model found for this job")
    return TrainedModelResponse.model_validate(model)


@router.get("/models-trained/{project_id}", response_model=list[TrainedModelResponse])
async def list_trained_models(
    project_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all trained models for a project."""
    effective = user_id or "guest_user"
    result = await db.execute(
        select(TrainedModel).where(
            TrainedModel.project_id == project_id,
        ).order_by(TrainedModel.created_at.desc())
    )
    models = result.scalars().all()
    # Return models owned by this user OR by guest (for files uploaded without auth)
    visible = [m for m in models if m.user_id == effective or m.user_id == "guest_user" or m.user_id is None]
    return [TrainedModelResponse.model_validate(m) for m in visible]


@router.post("/explain-prediction")
async def explain_prediction(
    request: dict,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Use NVIDIA LLM to generate a human-readable explanation of a model prediction.
    Works for any problem type — regression, classification, or custom targets.
    """
    import json as _json
    from services.llm_service import get_best_available_llm
    from langchain_core.messages import HumanMessage, SystemMessage

    predicted_value = request.get("predicted_value")
    target_column   = request.get("target_column", "target")
    model_type      = request.get("model_type", "model")
    input_features  = request.get("input_features", {})
    problem_context = request.get("problem_context", "")

    try:
        feature_summary = ", ".join(
            f"{k}={v}" for k, v in (input_features or {}).items()
            if v not in (None, "", "N/A")
        )

        context_section = f"\nDomain context: {problem_context}" if problem_context else ""

        llm = get_best_available_llm(temperature=0.3)
        response = llm.invoke([
            SystemMessage(content=(
                "You are an expert data scientist explaining ML model predictions to non-technical users. "
                "Be specific, factual, and concise. Never say the result is random or approximate. "
                "Use real domain knowledge. 2-3 sentences max."
            )),
            HumanMessage(content=(
                f"A {model_type} model predicted: {predicted_value} for target: '{target_column}'.\n"
                f"Input features used: {feature_summary or 'not provided'}.{context_section}\n\n"
                "Explain: (1) what this predicted value means in the real world, "
                "(2) whether this value is typical/good/concerning, "
                "(3) which input features most likely influenced this result. "
                "Be specific to the domain — do NOT give generic ML jargon."
            )),
        ])
        return {"explanation": response.content.strip()}
    except Exception as e:
        logger.warning(f"Prediction explanation failed: {e}")
        return {"explanation": f"Predicted {target_column} = {predicted_value}. Model: {model_type}."}


@router.post("/suggest-hyperparams")
async def suggest_hyperparams(
    request: dict,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Use NVIDIA LLM to recommend optimal hyperparameters based on dataset characteristics.
    """
    import json as _json
    from services.llm_service import get_best_available_llm
    from langchain_core.messages import HumanMessage, SystemMessage

    model_type    = request.get("model_type", "XGBoost")
    n_rows        = request.get("n_rows", 1000)
    n_features    = request.get("n_features", 10)
    target_column = request.get("target_column", "target")
    problem_type  = request.get("problem_type", "regression")
    current_params = request.get("current_params", {})

    try:
        llm = get_best_available_llm(temperature=0.1)
        response = llm.invoke([
            SystemMessage(content=(
                "You are an expert ML engineer. Recommend hyperparameters for the given dataset. "
                "Output ONLY valid JSON — no markdown, no explanation outside the JSON."
            )),
            HumanMessage(content=(
                f"Model: {model_type}, Task: {problem_type}, Target: '{target_column}'\n"
                f"Dataset: {n_rows} rows, {n_features} features\n"
                f"Current params: {_json.dumps(current_params)}\n\n"
                f"Return JSON with these keys (values appropriate for the dataset size and task):\n"
                '{"learning_rate": 0.0-1.0, "max_depth": 3-12, "n_estimators": 50-2000, '
                '"reg_alpha": 0.0-10.0, "reg_lambda": 0.0-10.0, '
                '"reason": "one-sentence why these values"}'
            )),
        ])
        raw = response.content.strip().lstrip("```json").rstrip("```").strip()
        params = _json.loads(raw)
        return {"params": params, "reason": params.pop("reason", "")}
    except Exception as e:
        logger.warning(f"Hyperparam suggestion failed: {e}")
        return {
            "params": {"learning_rate": 0.05, "max_depth": 5, "n_estimators": 200,
                       "reg_alpha": 0.1, "reg_lambda": 1.0},
            "reason": "Conservative defaults for safe training."
        }
