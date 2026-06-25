"""
NeuralForge — Celery Training Tasks
Async tasks for model training: tabular (sklearn/xgboost/lgbm/catboost),
image classification (PyTorch), text classification (Transformers), and AutoML.
"""

import os
import json
import time
import logging
import traceback
from datetime import datetime, timezone

from workers.celery_app import app

logger = logging.getLogger("neuralforge.training")


def _resolve_target_column(target: str, columns) -> str:
    """
    Smart target column resolution:
    1. Exact match
    2. Whitespace-stripped case-insensitive match
    3. Acronym match  (State of Health → SOH, soh → SOH)
    4. Substring match (partial)
    """
    cols = list(columns)
    t = target.strip()

    # 1. Exact
    if t in cols:
        return t

    # 2. Case-insensitive
    t_low = t.lower()
    for c in cols:
        if c.strip().lower() == t_low:
            return c

    # 3a. Target → acronym (State of Health → soh)
    words = [w for w in t.replace("_", " ").replace("-", " ").split() if w]
    acronym = "".join(w[0] for w in words).lower()
    for c in cols:
        if c.strip().lower() == acronym:
            return c

    # 3b. Column → acronym of target name (SOH → compare against soh)
    for c in cols:
        c_words = [w for w in c.replace("_", " ").replace("-", " ").split() if w]
        c_acronym = "".join(w[0] for w in c_words).lower()
        if c_acronym == t_low:
            return c

    # 4. Substring (partial match either direction, prefer longer match)
    candidates = []
    for c in cols:
        c_low = c.strip().lower()
        if t_low in c_low or c_low in t_low:
            candidates.append(c)
    if len(candidates) == 1:
        return candidates[0]
    if len(candidates) > 1:
        # Prefer the column whose lowercase is closest in length to target
        candidates.sort(key=lambda c: abs(len(c) - len(t)))
        return candidates[0]

    raise ValueError(
        f"Target column '{target}' not found. Available: {cols}"
    )


def _get_model_path(model_id: str) -> str | None:
    """Look up the file path of a trained model by its ID."""
    try:
        from sqlalchemy import create_engine, text
        db_url = os.getenv("DATABASE_URL", "sqlite:///./neuralforge.db")
        sync_url = db_url.replace("sqlite+aiosqlite", "sqlite").replace("postgresql+asyncpg", "postgresql")
        engine = create_engine(sync_url)
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT model_path FROM trained_models WHERE id = :id"),
                {"id": model_id},
            ).fetchone()
        engine.dispose()
        return row[0] if row else None
    except Exception as e:
        logger.warning(f"_get_model_path failed: {e}")
        return None


def _update_job_db(job_id: str, updates: dict):
    """Update training job record in the database synchronously."""
    # Use synchronous SQLAlchemy for Celery worker context
    try:
        from sqlalchemy import create_engine, text
        db_url = os.getenv("DATABASE_URL", "sqlite:///./neuralforge.db")
        # Convert async URL to sync for celery workers
        sync_url = db_url.replace("sqlite+aiosqlite", "sqlite").replace("postgresql+asyncpg", "postgresql")
        engine = create_engine(sync_url)
        set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        with engine.connect() as conn:
            conn.execute(
                text(f"UPDATE training_jobs SET {set_clauses} WHERE id = :job_id"),
                {**updates, "job_id": job_id},
            )
            conn.commit()
        engine.dispose()
    except Exception as e:
        logger.error(f"Failed to update job {job_id}: {e}")
def _save_model_record(job_id: str, model_path: str, model_format: str, metrics: dict, training_params: dict):
    """Create a TrainedModel record in the database (legacy, no feature info)."""
    _save_model_record_with_features(
        job_id, model_path, model_format, metrics, training_params,
        feature_names=[], feature_types={}, training_data_path="",
    )


def _save_model_record_with_features(
    job_id: str, model_path: str, model_format: str, metrics: dict,
    training_params: dict, feature_names: list = None,
    feature_types: dict = None, training_data_path: str = "",
):
    """Create a TrainedModel record with feature names and types for dynamic testing UI."""
    import uuid
    try:
        from sqlalchemy import create_engine, text
        db_url = os.getenv("DATABASE_URL", "sqlite:///./neuralforge.db")
        sync_url = db_url.replace("sqlite+aiosqlite", "sqlite").replace("postgresql+asyncpg", "postgresql")
        engine = create_engine(sync_url)

        model_id = str(uuid.uuid4())
        model_size = os.path.getsize(model_path) if os.path.exists(model_path) else 0

        dataset_info = {
            "training_data_path": training_data_path or "",
        }

        with engine.connect() as conn:
            # Get job details
            result = conn.execute(
                text("SELECT project_id, user_id, task_type, model_name FROM training_jobs WHERE id = :job_id"),
                {"job_id": job_id},
            )
            job = result.fetchone()
            if not job:
                return

            conn.execute(
                text("""
                    INSERT INTO trained_models
                    (id, training_job_id, project_id, user_id, model_name, task_type,
                     model_path, model_format, model_size, metrics, export_formats,
                     version, is_best, dataset_info, training_params,
                     feature_names, feature_types, created_at)
                    VALUES
                    (:id, :training_job_id, :project_id, :user_id, :model_name, :task_type,
                     :model_path, :model_format, :model_size, :metrics, :export_formats,
                      1, 1, :dataset_info, :training_params,
                     :feature_names, :feature_types, :created_at)
                """),
                {
                    "id": model_id,
                    "training_job_id": job_id,
                    "project_id": job[0],
                    "user_id": job[1],
                    "model_name": job[3],
                    "task_type": job[2],
                    "model_path": model_path,
                    "model_format": model_format,
                    "model_size": model_size,
                    "metrics": json.dumps(metrics),
                    "export_formats": json.dumps({model_format: model_path}),
                    "dataset_info": json.dumps(dataset_info),
                    "training_params": json.dumps(training_params),
                    "feature_names": json.dumps(feature_names or []),
                    "feature_types": json.dumps(feature_types or {}),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            conn.commit()
        engine.dispose()
    except Exception as e:
        logger.error(f"Failed to save model record: {e}")


@app.task(bind=True, name="workers.training_tasks.train_tabular")
def train_tabular(self, job_id: str, file_path: str, target_column: str,
                  model_name: str, training_config: dict):
    """Train a tabular model using sklearn/xgboost/lgbm/catboost."""
    try:
        _update_job_db(job_id, {
            "status": "training",
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        import pandas as pd
        import numpy as np
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import (
            accuracy_score, f1_score, precision_score, recall_score,
            mean_squared_error, r2_score,
        )
        import joblib

        # Load data
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(file_path)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(file_path)
        elif ext == ".json":
            df = pd.read_json(file_path)
        else:
            df = pd.read_csv(file_path)

        # Normalize column names (strip whitespace)
        df.columns = df.columns.str.strip()

        # Smart target column resolution (handles acronyms, case, substrings)
        target_column = _resolve_target_column(target_column, df.columns)

        # Prepare data
        X = df.drop(columns=[target_column])
        y = df[target_column]

        # Handle non-numeric features
        for col in X.select_dtypes(include=["object"]).columns:
            X[col] = X[col].astype("category").cat.codes

        # Handle missing values
        X = X.fillna(X.median(numeric_only=True))

        # Determine task type
        is_classification = y.nunique() < 50 or y.dtype == "object"
        if y.dtype == "object":
            y = y.astype("category").cat.codes

        # Split
        val_split = training_config.get("validation_split", 0.2)
        seed = training_config.get("random_seed", 42)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=val_split, random_state=seed)

        _update_job_db(job_id, {"progress": 20.0})

        # Store feature names and types for dynamic testing UI
        feature_names = list(X.columns)
        feature_types = {}
        for col in X.columns:
            if X[col].dtype in ('float64', 'float32', 'int64', 'int32'):
                feature_types[col] = 'numeric'
            else:
                feature_types[col] = 'categorical'

        # Build model — or load existing for warm-start (Continue Training)
        model = _build_tabular_model(model_name, is_classification, training_config)
        continue_from_model_id = training_config.get("continue_from_model_id")
        epoch_offset = int(training_config.get("epoch_offset", 0))
        checkpoint_path = None

        if continue_from_model_id:
            try:
                checkpoint_path = _get_model_path(continue_from_model_id)
                if checkpoint_path and os.path.exists(checkpoint_path):
                    logger.info(f"Warm-start from checkpoint: {checkpoint_path}")
                else:
                    checkpoint_path = None
                    logger.warning(f"Checkpoint {continue_from_model_id} not found, starting fresh")
            except Exception as e:
                logger.warning(f"Could not load checkpoint: {e}")
                checkpoint_path = None

        # Train with per-epoch tracking for boosting models
        n_estimators = training_config.get("n_estimators", 100)
        epoch_history = []
        model_lower = model_name.lower()

        if model_lower in ("xgboost", "lightgbm"):
            # Use eval_set for per-round loss tracking
            total_rounds = n_estimators
            _update_job_db(job_id, {"total_epochs": total_rounds})

            eval_set = [(X_train, y_train), (X_test, y_test)]
            # XGBoost: pass xgb_model to continue from checkpoint
            fit_kwargs: dict = {"eval_set": eval_set, "verbose": False}
            if checkpoint_path and model_lower == "xgboost":
                fit_kwargs["xgb_model"] = checkpoint_path
            model.fit(X_train, y_train, **fit_kwargs)

            # Extract per-round metrics from eval results
            if hasattr(model, 'evals_result_'):
                evals = model.evals_result_
                # XGBoost format: {'validation_0': {'logloss': [...]}, 'validation_1': {'logloss': [...]}}
                train_losses = list(list(evals.get('validation_0', {}).values())[0]) if evals.get('validation_0') else []
                val_losses = list(list(evals.get('validation_1', {}).values())[0]) if evals.get('validation_1') else []

                for i in range(len(train_losses)):
                    epoch_data = {
                        "epoch": epoch_offset + i + 1,
                        "total_epochs": epoch_offset + total_rounds,
                        "train_loss": round(train_losses[i], 6),
                        "val_loss": round(val_losses[i], 6) if i < len(val_losses) else 0,
                    }
                    epoch_history.append(epoch_data)

                    # Update DB every 10 rounds for progress
                    if (i + 1) % max(1, total_rounds // 10) == 0 or i == len(train_losses) - 1:
                        progress = ((i + 1) / total_rounds) * 80 + 20
                        _update_job_db(job_id, {
                            "progress": round(progress, 1),
                            "current_epoch": i + 1,
                            "metrics": json.dumps({"epoch_history": epoch_history}),
                        })
        else:
            # Non-boosting models: single fit
            _update_job_db(job_id, {"progress": 40.0, "current_epoch": 1, "total_epochs": 1})
            model.fit(X_train, y_train)

        _update_job_db(job_id, {"progress": 85.0})

        # Evaluate
        y_pred = model.predict(X_test)
        if is_classification:
            metrics = {
                "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
                "f1": round(float(f1_score(y_test, y_pred, average="weighted")), 4),
                "precision": round(float(precision_score(y_test, y_pred, average="weighted")), 4),
                "recall": round(float(recall_score(y_test, y_pred, average="weighted")), 4),
            }
        else:
            metrics = {
                "mse": round(float(mean_squared_error(y_test, y_pred)), 4),
                "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4),
                "r2": round(float(r2_score(y_test, y_pred)), 4),
            }

        # Also compute train metrics for generalization gap
        y_train_pred = model.predict(X_train)
        if is_classification:
            train_metrics = {
                "accuracy": round(float(accuracy_score(y_train, y_train_pred)), 4),
                "f1": round(float(f1_score(y_train, y_train_pred, average="weighted")), 4),
            }
            # Add accuracy to epoch_history entries
            for ed in epoch_history:
                ed["train_acc"] = round(train_metrics["accuracy"] * 100, 1)
                ed["val_acc"] = round(metrics["accuracy"] * 100, 1)
        else:
            train_metrics = {
                "r2": round(float(r2_score(y_train, y_train_pred)), 4),
            }

        # Save model
        model_dir = os.getenv("MODEL_STORAGE_DIR", "./models_storage")
        os.makedirs(model_dir, exist_ok=True)
        model_path = os.path.join(model_dir, f"{job_id}_model.joblib")
        joblib.dump(model, model_path)

        # Save checkpoint
        try:
            from services.checkpoint_service import checkpoint_service
            checkpoint_service.save_checkpoint(
                job_id, model, epoch=n_estimators, metrics=metrics,
                model_format="joblib", is_best=True,
            )
        except Exception as ckpt_err:
            logger.warning("Checkpoint save failed (non-fatal): %s", ckpt_err)

        # Build final metrics with epoch_history
        final_metrics_payload = {
            "final_metrics": metrics,
            "train_metrics": train_metrics,
            "epoch_history": epoch_history,
        }

        # Update job as completed
        _update_job_db(job_id, {
            "status": "completed",
            "progress": 100.0,
            "current_epoch": n_estimators if epoch_history else 1,
            "total_epochs": n_estimators if epoch_history else 1,
            "metrics": json.dumps(final_metrics_payload),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        # Save trained model record with feature info
        _save_model_record_with_features(
            job_id, model_path, "joblib", metrics, training_config,
            feature_names, feature_types, file_path,
        )

        return {"status": "completed", "metrics": metrics, "model_path": model_path}

    except Exception as e:
        logger.error(f"Training failed for job {job_id}: {traceback.format_exc()}")
        _update_job_db(job_id, {
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "failed", "error": str(e)}


def _build_tabular_model(model_name: str, is_classification: bool, config: dict):
    """Build a tabular ML model from name."""
    seed = config.get("random_seed", 42)

    if model_name.lower() == "xgboost":
        import xgboost as xgb
        early_stopping = config.get("early_stopping_rounds")
        common = dict(
            n_estimators=config.get("n_estimators", 100),
            max_depth=config.get("max_depth", 6),
            learning_rate=config.get("learning_rate", 0.1),
            reg_alpha=config.get("reg_alpha", 0.0),
            reg_lambda=config.get("reg_lambda", 1.0),
            random_state=seed,
            early_stopping_rounds=early_stopping if early_stopping else None,
        )
        if is_classification:
            return xgb.XGBClassifier(**common, use_label_encoder=False, eval_metric="logloss")
        else:
            return xgb.XGBRegressor(**common, eval_metric="rmse")

    elif model_name.lower() == "lightgbm":
        import lightgbm as lgb
        lgb_common = dict(
            n_estimators=config.get("n_estimators", 100),
            max_depth=config.get("max_depth", -1),
            learning_rate=config.get("learning_rate", 0.1),
            reg_alpha=config.get("reg_alpha", 0.0),
            reg_lambda=config.get("reg_lambda", 1.0),
            random_state=seed,
            verbose=-1,
        )
        if is_classification:
            return lgb.LGBMClassifier(**lgb_common)
        else:
            return lgb.LGBMRegressor(**lgb_common)

    elif model_name.lower() == "catboost":
        from catboost import CatBoostClassifier, CatBoostRegressor
        if is_classification:
            return CatBoostClassifier(
                iterations=config.get("n_estimators", 100),
                depth=config.get("max_depth", 6),
                learning_rate=config.get("learning_rate", 0.1),
                random_seed=seed,
                verbose=0,
            )
        else:
            return CatBoostRegressor(
                iterations=config.get("n_estimators", 100),
                depth=config.get("max_depth", 6),
                learning_rate=config.get("learning_rate", 0.1),
                random_seed=seed,
                verbose=0,
            )

    elif model_name.lower() == "random_forest":
        from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
        if is_classification:
            return RandomForestClassifier(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", None),
                random_state=seed,
            )
        else:
            return RandomForestRegressor(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", None),
                random_state=seed,
            )

    elif model_name.lower() == "gradient_boosting":
        from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
        if is_classification:
            return GradientBoostingClassifier(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", 3),
                learning_rate=config.get("learning_rate", 0.1),
                random_state=seed,
            )
        else:
            return GradientBoostingRegressor(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", 3),
                learning_rate=config.get("learning_rate", 0.1),
                random_state=seed,
            )

    elif model_name.lower() == "extra_trees":
        from sklearn.ensemble import ExtraTreesClassifier, ExtraTreesRegressor
        if is_classification:
            return ExtraTreesClassifier(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", None),
                random_state=seed,
            )
        else:
            return ExtraTreesRegressor(
                n_estimators=config.get("n_estimators", 100),
                max_depth=config.get("max_depth", None),
                random_state=seed,
            )

    elif model_name.lower() == "adaboost":
        from sklearn.ensemble import AdaBoostClassifier, AdaBoostRegressor
        if is_classification:
            return AdaBoostClassifier(
                n_estimators=config.get("n_estimators", 50),
                learning_rate=config.get("learning_rate", 1.0),
                random_state=seed,
            )
        else:
            return AdaBoostRegressor(
                n_estimators=config.get("n_estimators", 50),
                learning_rate=config.get("learning_rate", 1.0),
                random_state=seed,
            )

    elif model_name.lower() == "svm":
        from sklearn.svm import SVC, SVR
        if is_classification:
            return SVC(
                C=config.get("C", 1.0),
                probability=True,
                random_state=seed,
            )
        else:
            return SVR(
                C=config.get("C", 1.0),
            )

    elif model_name.lower() == "knn":
        from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
        if is_classification:
            return KNeighborsClassifier(
                n_neighbors=config.get("n_neighbors", 5),
            )
        else:
            return KNeighborsRegressor(
                n_neighbors=config.get("n_neighbors", 5),
            )
            
    elif model_name.lower() == "decision_tree":
        from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
        if is_classification:
            return DecisionTreeClassifier(
                max_depth=config.get("max_depth", None),
                random_state=seed,
            )
        else:
            return DecisionTreeRegressor(
                max_depth=config.get("max_depth", None),
                random_state=seed,
            )

    elif model_name.lower() in ("logistic_regression", "linear_regression"):
        from sklearn.linear_model import LogisticRegression, LinearRegression
        if is_classification:
            return LogisticRegression(max_iter=1000, random_state=seed)
        else:
            return LinearRegression()
            
    else:
        # Default fallback
        from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
        if is_classification:
            return RandomForestClassifier(n_estimators=100, random_state=seed)
        else:
            return RandomForestRegressor(n_estimators=100, random_state=seed)


@app.task(bind=True, name="workers.training_tasks.train_automl")
def train_automl(self, job_id: str, file_path: str, target_column: str, training_config: dict):
    """AutoML: runs multiple models and selects the best one."""
    try:
        _update_job_db(job_id, {
            "status": "training",
            "is_automl": True,
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        import pandas as pd
        import numpy as np
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score
        import joblib

        # Load data
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".csv":
            df = pd.read_csv(file_path)
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(file_path)
        else:
            df = pd.read_csv(file_path)

        df.columns = df.columns.str.strip()
        target_column = _resolve_target_column(target_column, df.columns)

        X = df.drop(columns=[target_column])
        y = df[target_column]

        for col in X.select_dtypes(include=["object"]).columns:
            X[col] = X[col].astype("category").cat.codes
        X = X.fillna(X.median(numeric_only=True))

        is_classification = y.nunique() < 50 or y.dtype == "object"
        if y.dtype == "object":
            y = y.astype("category").cat.codes

        val_split = training_config.get("validation_split", 0.2)
        seed = training_config.get("random_seed", 42)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=val_split, random_state=seed)

        # Models to try
        model_names = ["xgboost", "lightgbm", "random_forest", "gradient_boosting"]
        leaderboard = []
        best_model = None
        best_score = -float("inf")

        for i, name in enumerate(model_names):
            progress = 20 + (i / len(model_names)) * 60
            _update_job_db(job_id, {
                "progress": round(progress, 1),
                "current_epoch": i + 1,
                "total_epochs": len(model_names),
            })

            try:
                model = _build_tabular_model(name, is_classification, training_config)
                start_time = time.time()
                model.fit(X_train, y_train)
                train_time = round(time.time() - start_time, 2)

                y_pred = model.predict(X_test)

                if is_classification:
                    score = float(accuracy_score(y_test, y_pred))
                    f1 = float(f1_score(y_test, y_pred, average="weighted"))
                    entry = {
                        "model": name,
                        "accuracy": round(score, 4),
                        "f1": round(f1, 4),
                        "training_time": train_time,
                    }
                else:
                    mse = float(mean_squared_error(y_test, y_pred))
                    r2 = float(r2_score(y_test, y_pred))
                    score = r2
                    entry = {
                        "model": name,
                        "mse": round(mse, 4),
                        "r2": round(r2, 4),
                        "rmse": round(float(np.sqrt(mse)), 4),
                        "training_time": train_time,
                    }

                leaderboard.append(entry)

                if score > best_score:
                    best_score = score
                    best_model = model
                    best_model_name = name

            except Exception as e:
                logger.warning(f"AutoML: {name} failed: {e}")
                leaderboard.append({"model": name, "error": str(e)})

        # Save best model
        if best_model is not None:
            model_dir = os.getenv("MODEL_STORAGE_DIR", "./models_storage")
            os.makedirs(model_dir, exist_ok=True)
            model_path = os.path.join(model_dir, f"{job_id}_best_model.joblib")
            joblib.dump(best_model, model_path)

            # Find best entry metrics
            best_entry = next((e for e in leaderboard if e.get("model") == best_model_name), {})
            metrics = {k: v for k, v in best_entry.items() if k not in ("model", "training_time", "error")}

            _update_job_db(job_id, {
                "status": "completed",
                "progress": 100.0,
                "metrics": json.dumps({"final_metrics": metrics}),
                "automl_results": json.dumps({"leaderboard": leaderboard, "best_model": best_model_name}),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })

            _save_model_record(job_id, model_path, "joblib", metrics, training_config)

            return {"status": "completed", "leaderboard": leaderboard, "best_model": best_model_name}
        else:
            _update_job_db(job_id, {
                "status": "failed",
                "error_message": "All models failed during AutoML",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            return {"status": "failed", "error": "All models failed"}

    except Exception as e:
        logger.error(f"AutoML failed for job {job_id}: {traceback.format_exc()}")
        _update_job_db(job_id, {
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "failed", "error": str(e)}


@app.task(bind=True, name="workers.training_tasks.train_image_classification")
def train_image_classification(self, job_id: str, dataset_path: str,
                               model_name: str, training_config: dict,
                               augmentation_config: dict = None):
    """Train image classification model using PyTorch + torchvision."""
    try:
        _update_job_db(job_id, {
            "status": "training",
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        import torch
        import torch.nn as nn
        import torch.optim as optim
        from torchvision import datasets, transforms, models
        from torch.utils.data import DataLoader, random_split

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Training on device: {device}")

        epochs = training_config.get("epochs", 10)
        batch_size = training_config.get("batch_size", 32)
        lr = training_config.get("learning_rate", 0.001)
        val_split = training_config.get("validation_split", 0.2)

        # Data transforms
        train_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip() if augmentation_config and augmentation_config.get("horizontal_flip") else transforms.Lambda(lambda x: x),
            transforms.RandomRotation(augmentation_config.get("rotation", 0)) if augmentation_config and augmentation_config.get("rotation") else transforms.Lambda(lambda x: x),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        val_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])

        # Load dataset
        full_dataset = datasets.ImageFolder(dataset_path, transform=train_transform)
        num_classes = len(full_dataset.classes)

        # Split
        val_size = int(len(full_dataset) * val_split)
        train_size = len(full_dataset) - val_size
        train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])
        val_dataset.dataset.transform = val_transform

        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=2)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=2)

        # Build model
        model = _build_vision_model(model_name, num_classes)
        model = model.to(device)

        criterion = nn.CrossEntropyLoss()
        optimizer_name = training_config.get("optimizer", "adam").lower()
        if optimizer_name == "adamw":
            optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=training_config.get("weight_decay", 0.01))
        elif optimizer_name == "sgd":
            optimizer = optim.SGD(model.parameters(), lr=lr, momentum=0.9, weight_decay=training_config.get("weight_decay", 0.0001))
        else:
            optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=training_config.get("weight_decay", 0.0001))

        # Training loop
        train_losses = []
        val_losses = []
        train_accs = []
        val_accs = []
        best_val_acc = 0.0
        patience = training_config.get("early_stopping_patience", 5)
        patience_counter = 0

        _update_job_db(job_id, {"total_epochs": epochs})

        for epoch in range(epochs):
            # Train
            model.train()
            running_loss = 0.0
            correct = 0
            total = 0

            for batch_idx, (inputs, labels) in enumerate(train_loader):
                inputs, labels = inputs.to(device), labels.to(device)
                optimizer.zero_grad()
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                loss.backward()
                optimizer.step()

                running_loss += loss.item()
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()

            train_loss = running_loss / len(train_loader)
            train_acc = correct / total
            train_losses.append(round(train_loss, 4))
            train_accs.append(round(train_acc, 4))

            # Validate
            model.eval()
            val_loss = 0.0
            val_correct = 0
            val_total = 0

            with torch.no_grad():
                for inputs, labels in val_loader:
                    inputs, labels = inputs.to(device), labels.to(device)
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)
                    val_loss += loss.item()
                    _, predicted = outputs.max(1)
                    val_total += labels.size(0)
                    val_correct += predicted.eq(labels).sum().item()

            val_loss = val_loss / len(val_loader) if len(val_loader) > 0 else 0
            val_acc = val_correct / val_total if val_total > 0 else 0
            val_losses.append(round(val_loss, 4))
            val_accs.append(round(val_acc, 4))

            # Update progress
            progress = ((epoch + 1) / epochs) * 100
            _update_job_db(job_id, {
                "progress": round(progress, 1),
                "current_epoch": epoch + 1,
                "metrics": json.dumps({
                    "train_loss": train_losses,
                    "val_loss": val_losses,
                    "train_accuracy": train_accs,
                    "val_accuracy": val_accs,
                }),
            })

            # Early stopping
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                patience_counter = 0
                # Save best checkpoint
                model_dir = os.getenv("MODEL_STORAGE_DIR", "./models_storage")
                os.makedirs(model_dir, exist_ok=True)
                best_model_path = os.path.join(model_dir, f"{job_id}_best.pt")
                torch.save(model.state_dict(), best_model_path)
            else:
                patience_counter += 1
                if training_config.get("early_stopping", False) and patience_counter >= patience:
                    logger.info(f"Early stopping at epoch {epoch + 1}")
                    break

        # Final metrics
        final_metrics = {
            "accuracy": round(best_val_acc, 4),
            "final_train_loss": train_losses[-1],
            "final_val_loss": val_losses[-1],
            "final_train_accuracy": train_accs[-1],
            "final_val_accuracy": val_accs[-1],
            "best_epoch": int(val_accs.index(max(val_accs)) + 1),
            "num_classes": num_classes,
            "classes": full_dataset.classes,
        }

        model_dir = os.getenv("MODEL_STORAGE_DIR", "./models_storage")
        model_path = os.path.join(model_dir, f"{job_id}_best.pt")

        _update_job_db(job_id, {
            "status": "completed",
            "progress": 100.0,
            "metrics": json.dumps({
                "train_loss": train_losses,
                "val_loss": val_losses,
                "train_accuracy": train_accs,
                "val_accuracy": val_accs,
                "final_metrics": final_metrics,
            }),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        _save_model_record(job_id, model_path, "pt", final_metrics, training_config)

        return {"status": "completed", "metrics": final_metrics}

    except Exception as e:
        logger.error(f"Image training failed for job {job_id}: {traceback.format_exc()}")
        _update_job_db(job_id, {
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "failed", "error": str(e)}


def _build_vision_model(model_name: str, num_classes: int):
    """Build a torchvision model with transfer learning."""
    from torchvision import models
    import torch.nn as nn

    name = model_name.lower()

    if "resnet50" in name:
        model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
    elif "resnet18" in name:
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        model.fc = nn.Linear(model.fc.in_features, num_classes)
    elif "efficientnet" in name:
        model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, num_classes)
    elif "mobilenet" in name:
        model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
        model.classifier[3] = nn.Linear(model.classifier[3].in_features, num_classes)
    elif "densenet" in name:
        model = models.densenet121(weights=models.DenseNet121_Weights.DEFAULT)
        model.classifier = nn.Linear(model.classifier.in_features, num_classes)
    elif "vit" in name:
        model = models.vit_b_16(weights=models.ViT_B_16_Weights.DEFAULT)
        model.heads.head = nn.Linear(model.heads.head.in_features, num_classes)
    elif "convnext" in name:
        model = models.convnext_tiny(weights=models.ConvNeXt_Tiny_Weights.DEFAULT)
        model.classifier[2] = nn.Linear(model.classifier[2].in_features, num_classes)
    else:
        # Default to ResNet18
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        model.fc = nn.Linear(model.fc.in_features, num_classes)

    return model


@app.task(bind=True, name="workers.training_tasks.train_text_classification")
def train_text_classification(self, job_id: str, file_path: str, target_column: str,
                              text_column: str, model_name: str, training_config: dict):
    """Train text classification using HuggingFace Transformers."""
    try:
        _update_job_db(job_id, {
            "status": "training",
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        import pandas as pd
        import torch
        from transformers import (
            AutoTokenizer, AutoModelForSequenceClassification,
            TrainingArguments, Trainer,
        )
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score, f1_score

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Load data
        df = pd.read_csv(file_path)
        texts = df[text_column].astype(str).tolist()
        labels = df[target_column]
        if labels.dtype == "object":
            label_map = {l: i for i, l in enumerate(labels.unique())}
            labels = labels.map(label_map).tolist()
            num_labels = len(label_map)
        else:
            labels = labels.tolist()
            num_labels = len(set(labels))

        val_split = training_config.get("validation_split", 0.2)
        train_texts, val_texts, train_labels, val_labels = train_test_split(
            texts, labels, test_size=val_split, random_state=42
        )

        # Load model and tokenizer
        hf_model_name = _get_hf_model_name(model_name)
        tokenizer = AutoTokenizer.from_pretrained(hf_model_name)
        model = AutoModelForSequenceClassification.from_pretrained(hf_model_name, num_labels=num_labels)

        # Tokenize
        train_encodings = tokenizer(train_texts, truncation=True, padding=True, max_length=512)
        val_encodings = tokenizer(val_texts, truncation=True, padding=True, max_length=512)

        class TextDataset(torch.utils.data.Dataset):
            def __init__(self, encodings, labels):
                self.encodings = encodings
                self.labels = labels
            def __getitem__(self, idx):
                item = {k: torch.tensor(v[idx]) for k, v in self.encodings.items()}
                item["labels"] = torch.tensor(self.labels[idx])
                return item
            def __len__(self):
                return len(self.labels)

        train_dataset = TextDataset(train_encodings, train_labels)
        val_dataset = TextDataset(val_encodings, val_labels)

        epochs = training_config.get("epochs", 3)
        batch_size = training_config.get("batch_size", 16)
        lr = training_config.get("learning_rate", 2e-5)

        model_dir = os.getenv("MODEL_STORAGE_DIR", "./models_storage")
        output_dir = os.path.join(model_dir, f"{job_id}_text_model")

        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size,
            learning_rate=lr,
            eval_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="accuracy",
            logging_steps=10,
        )

        def compute_metrics(eval_pred):
            predictions, labels = eval_pred
            preds = predictions.argmax(-1)
            return {
                "accuracy": float(accuracy_score(labels, preds)),
                "f1": float(f1_score(labels, preds, average="weighted")),
            }

        _update_job_db(job_id, {"total_epochs": epochs})

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            compute_metrics=compute_metrics,
        )

        trainer.train()

        # Evaluate
        eval_results = trainer.evaluate()
        metrics = {
            "accuracy": round(eval_results.get("eval_accuracy", 0), 4),
            "f1": round(eval_results.get("eval_f1", 0), 4),
        }

        # Save
        trainer.save_model(output_dir)
        tokenizer.save_pretrained(output_dir)

        _update_job_db(job_id, {
            "status": "completed",
            "progress": 100.0,
            "metrics": json.dumps({"final_metrics": metrics}),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        _save_model_record(job_id, output_dir, "pt", metrics, training_config)

        return {"status": "completed", "metrics": metrics}

    except Exception as e:
        logger.error(f"Text training failed for job {job_id}: {traceback.format_exc()}")
        _update_job_db(job_id, {
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "failed", "error": str(e)}


def _get_hf_model_name(model_name: str) -> str:
    """Map friendly model names to HuggingFace model IDs."""
    mapping = {
        "bert": "bert-base-uncased",
        "distilbert": "distilbert-base-uncased",
        "roberta": "roberta-base",
        "deberta": "microsoft/deberta-v3-base",
        "albert": "albert-base-v2",
    }
    return mapping.get(model_name.lower(), model_name)


@app.task(bind=True, name="workers.training_tasks.train_object_detection")
def train_object_detection(self, job_id: str, dataset_path: str,
                           model_name: str, training_config: dict):
    """Train object detection using Ultralytics YOLO."""
    try:
        _update_job_db(job_id, {
            "status": "training",
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        from ultralytics import YOLO

        epochs = training_config.get("epochs", 50)
        batch_size = training_config.get("batch_size", 16)
        img_size = training_config.get("img_size", 640)

        # Select YOLO variant
        yolo_variant = model_name.lower() if "yolo" in model_name.lower() else "yolov8n"
        model = YOLO(f"{yolo_variant}.pt")

        model_dir = os.getenv("MODEL_STORAGE_DIR", "./models_storage")
        project_dir = os.path.join(model_dir, f"{job_id}_yolo")

        _update_job_db(job_id, {"total_epochs": epochs})

        results = model.train(
            data=dataset_path,
            epochs=epochs,
            batch=batch_size,
            imgsz=img_size,
            project=project_dir,
            name="train",
            verbose=True,
        )

        # Get best model path
        best_model_path = os.path.join(project_dir, "train", "weights", "best.pt")

        metrics = {}
        if hasattr(results, "results_dict"):
            metrics = {k: round(float(v), 4) for k, v in results.results_dict.items()}

        _update_job_db(job_id, {
            "status": "completed",
            "progress": 100.0,
            "metrics": json.dumps({"final_metrics": metrics}),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        _save_model_record(job_id, best_model_path, "pt", metrics, training_config)

        return {"status": "completed", "metrics": metrics}

    except Exception as e:
        logger.error(f"Object detection failed for job {job_id}: {traceback.format_exc()}")
        _update_job_db(job_id, {
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "failed", "error": str(e)}
