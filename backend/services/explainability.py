"""
NeuralForge — Explainability Service
Comprehensive XAI engine integrating SHAP, LIME, decision path extraction,
permutation importance, confidence breakdown, and natural language explanations.
"""

import os
import io
import logging
from typing import Dict, Any, List, Optional

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Prevent GUI popups
import matplotlib.pyplot as plt

# We wrap imports in try/except because shap/lime are heavy and might be optional
try:
    import shap
except ImportError:
    shap = None

try:
    from lime.lime_tabular import LimeTabularExplainer
except ImportError:
    LimeTabularExplainer = None

logger = logging.getLogger("neuralforge.explainability")

class ExplainabilityService:
    
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    # ================================================================
    # GLOBAL Explanations (precomputed after training)
    # ================================================================

    def generate_shap_global_explanation(self, model: Any, X: pd.DataFrame, model_name: str, project_id: str, is_tree: bool = False) -> str:
        """
        Generate a SHAP summary plot (global feature importance) and save to disk.
        Returns the path to the saved image.
        """
        if not shap:
            logger.warning("SHAP is not installed.")
            return None

        plt.figure()
        
        try:
            # Subsample X if it's too large to prevent long compute times
            if len(X) > 1000:
                X_sample = shap.sample(X, 1000)
            else:
                X_sample = X

            if is_tree:
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(X_sample)
            else:
                # KernelExplainer is slow but model-agnostic
                # We use a small background dataset
                background = shap.kmeans(X_sample, 10)
                explainer = shap.KernelExplainer(model.predict, background)
                shap_values = explainer.shap_values(X_sample)

            # Generate summary plot
            # shap.summary_plot handles plt.show() internally if not configured, 
            # we need to pass show=False to save it.
            shap.summary_plot(shap_values, X_sample, show=False)
            
            # Save plot
            model_dir = os.path.join(self.storage_dir, project_id, "explanations")
            os.makedirs(model_dir, exist_ok=True)
            
            save_path = os.path.join(model_dir, f"{model_name}_shap_summary.png")
            plt.tight_layout()
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close()
            
            return save_path
        except Exception as e:
            logger.error(f"Failed to generate SHAP plot: {e}")
            plt.close()
            return None

    def generate_global_feature_importance(self, model: Any, X: pd.DataFrame, is_tree: bool = False) -> Dict[str, float]:
        """
        Compute global SHAP-based feature importance.
        Returns a dict of feature_name -> importance_score.
        """
        if not shap:
            return self.generate_feature_importance_json(model, list(X.columns))

        try:
            if len(X) > 500:
                X_sample = X.sample(500, random_state=42)
            else:
                X_sample = X

            if is_tree:
                explainer = shap.TreeExplainer(model)
            else:
                background = shap.kmeans(X_sample, min(10, len(X_sample)))
                explainer = shap.KernelExplainer(model.predict, background)

            shap_values = explainer.shap_values(X_sample)

            # Handle multi-class output
            if isinstance(shap_values, list):
                # Average absolute SHAP across classes
                mean_abs = np.mean([np.abs(sv).mean(axis=0) for sv in shap_values], axis=0)
            else:
                mean_abs = np.abs(shap_values).mean(axis=0)

            importance = {name: float(val) for name, val in zip(X.columns, mean_abs)}
            # Normalize to sum to 1
            total = sum(importance.values())
            if total > 0:
                importance = {k: v / total for k, v in importance.items()}

            # Sort descending
            importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
            return importance

        except Exception as e:
            logger.warning(f"SHAP global importance failed, falling back to native: {e}")
            return self.generate_feature_importance_json(model, list(X.columns))

    def generate_feature_importance_json(self, model: Any, feature_names: List[str]) -> Dict[str, float]:
        """
        Extract raw feature importances if the model supports it natively (e.g. Trees/XGBoost).
        """
        try:
            if hasattr(model, 'feature_importances_'):
                importances = model.feature_importances_
                result = {name: float(imp) for name, imp in zip(feature_names, importances)}
                total = sum(result.values())
                if total > 0:
                    result = {k: v / total for k, v in result.items()}
                return dict(sorted(result.items(), key=lambda x: x[1], reverse=True))
            elif hasattr(model, 'coef_'):
                importances = np.abs(model.coef_[0]) if len(model.coef_.shape) > 1 else np.abs(model.coef_)
                result = {name: float(imp) for name, imp in zip(feature_names, importances)}
                total = sum(result.values())
                if total > 0:
                    result = {k: v / total for k, v in result.items()}
                return dict(sorted(result.items(), key=lambda x: x[1], reverse=True))
            return {}
        except Exception as e:
            logger.error(f"Error extracting feature importances: {e}")
            return {}

    # ================================================================
    # LOCAL Explanations (per-prediction, on-the-fly)
    # ================================================================

    def generate_shap_local_explanation(
        self, model: Any, X_single: pd.DataFrame, X_background: pd.DataFrame = None,
        is_tree: bool = False, feature_names: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate per-prediction SHAP explanation.
        Returns feature contributions for a single prediction.
        """
        if not shap:
            return {"error": "SHAP not installed", "contributions": {}}

        try:
            if is_tree:
                explainer = shap.TreeExplainer(model)
            else:
                bg = X_background if X_background is not None else X_single
                if len(bg) > 100:
                    bg = shap.sample(bg, 100)
                background = shap.kmeans(bg, min(10, len(bg)))
                explainer = shap.KernelExplainer(model.predict, background)

            shap_values = explainer.shap_values(X_single)

            # Handle multi-class
            if isinstance(shap_values, list):
                # Use the class with highest probability
                if hasattr(model, 'predict_proba'):
                    proba = model.predict_proba(X_single)
                    predicted_class = int(np.argmax(proba[0]))
                    sv = shap_values[predicted_class][0]
                else:
                    sv = shap_values[0][0] if len(shap_values) > 0 else shap_values[0]
            else:
                sv = shap_values[0] if len(shap_values.shape) > 1 else shap_values

            names = feature_names or list(X_single.columns)
            contributions = {name: float(val) for name, val in zip(names, sv)}

            # Sort by absolute contribution
            contributions = dict(sorted(contributions.items(), key=lambda x: abs(x[1]), reverse=True))

            # Compute base value
            base_value = float(explainer.expected_value) if isinstance(explainer.expected_value, (int, float, np.floating)) else float(explainer.expected_value[0]) if hasattr(explainer.expected_value, '__len__') else 0.0

            return {
                "contributions": contributions,
                "base_value": base_value,
                "method": "SHAP",
            }

        except Exception as e:
            logger.error(f"SHAP local explanation failed: {e}")
            return {"error": str(e), "contributions": {}}

    def generate_lime_explanation(
        self, model: Any, X_single: np.ndarray, X_train: np.ndarray,
        feature_names: List[str], num_features: int = 10,
    ) -> Dict[str, Any]:
        """
        Generate LIME local explanation for a single prediction.
        """
        if LimeTabularExplainer is None:
            return {"error": "LIME not installed", "contributions": {}}

        try:
            # Determine if classification or regression
            mode = "classification" if hasattr(model, "predict_proba") else "regression"

            explainer = LimeTabularExplainer(
                training_data=X_train[:500] if len(X_train) > 500 else X_train,
                feature_names=feature_names,
                mode=mode,
                random_state=42,
            )

            if mode == "classification":
                explanation = explainer.explain_instance(
                    X_single.flatten(), model.predict_proba,
                    num_features=min(num_features, len(feature_names)),
                )
            else:
                explanation = explainer.explain_instance(
                    X_single.flatten(), model.predict,
                    num_features=min(num_features, len(feature_names)),
                )

            # Extract contributions
            contributions = {}
            for feature_desc, weight in explanation.as_list():
                # LIME returns strings like "feature_name <= 0.5", extract name
                for fn in feature_names:
                    if fn in feature_desc:
                        contributions[fn] = float(weight)
                        break

            return {
                "contributions": contributions,
                "intercept": float(explanation.intercept[1]) if mode == "classification" and len(explanation.intercept) > 1 else float(explanation.intercept[0]) if hasattr(explanation.intercept, '__len__') else 0.0,
                "score": float(explanation.score) if hasattr(explanation, 'score') else None,
                "method": "LIME",
            }

        except Exception as e:
            logger.error(f"LIME explanation failed: {e}")
            return {"error": str(e), "contributions": {}}

    def extract_decision_path(
        self, model: Any, X_single: pd.DataFrame, feature_names: List[str],
    ) -> List[Dict[str, Any]]:
        """
        For tree-based models, extract the actual decision path.
        Returns a list of decision steps, e.g.:
        [{"feature": "Age", "threshold": 45, "direction": ">", "value": True}, ...]
        """
        steps = []

        try:
            # Check for sklearn tree-based models
            if hasattr(model, 'estimators_'):
                # Random Forest / Gradient Boosting — use first tree
                if hasattr(model.estimators_[0], 'tree_'):
                    tree = model.estimators_[0]
                    if hasattr(tree, 'tree_'):
                        tree_obj = tree.tree_
                    else:
                        tree_obj = tree
                    steps = self._extract_tree_path(tree_obj, X_single.values[0], feature_names)
                elif hasattr(model.estimators_[0], '__iter__'):
                    # GBM with list of estimators per class
                    first_tree = model.estimators_[0][0] if hasattr(model.estimators_[0], '__iter__') else model.estimators_[0]
                    if hasattr(first_tree, 'tree_'):
                        steps = self._extract_tree_path(first_tree.tree_, X_single.values[0], feature_names)

            elif hasattr(model, 'tree_'):
                # Single DecisionTree
                steps = self._extract_tree_path(model.tree_, X_single.values[0], feature_names)

            elif hasattr(model, 'get_booster'):
                # XGBoost — extract text dump of first tree
                try:
                    booster = model.get_booster()
                    trees = booster.get_dump(with_stats=True)
                    if trees:
                        steps = self._parse_xgb_tree(trees[0], X_single.values[0], feature_names)
                except Exception:
                    pass

            if not steps:
                # Fallback: Generate a synthetic decision path from feature importance
                steps = self._generate_synthetic_path(model, X_single, feature_names)

        except Exception as e:
            logger.warning(f"Decision path extraction failed: {e}")
            steps = self._generate_synthetic_path(model, X_single, feature_names)

        return steps

    def _extract_tree_path(self, tree, sample, feature_names) -> List[Dict]:
        """Extract decision path from a sklearn tree object."""
        steps = []
        node_id = 0  # Start at root

        try:
            while tree.children_left[node_id] != tree.children_right[node_id]:  # Not a leaf
                feature_idx = tree.feature[node_id]
                threshold = float(tree.threshold[node_id])
                feature_name = feature_names[feature_idx] if feature_idx < len(feature_names) else f"feature_{feature_idx}"
                value = float(sample[feature_idx]) if feature_idx < len(sample) else 0

                goes_left = value <= threshold
                steps.append({
                    "step": len(steps) + 1,
                    "feature": feature_name,
                    "threshold": round(threshold, 4),
                    "direction": "<=" if goes_left else ">",
                    "value": round(value, 4),
                    "result": goes_left,
                })

                node_id = tree.children_left[node_id] if goes_left else tree.children_right[node_id]

                if len(steps) >= 10:  # Limit depth for readability
                    break
        except Exception as e:
            logger.warning(f"Tree path extraction error: {e}")

        return steps

    def _parse_xgb_tree(self, tree_dump: str, sample, feature_names) -> List[Dict]:
        """Parse XGBoost tree text dump into decision steps."""
        # Simplified parser — XGBoost dumps are complex
        steps = []
        for line in tree_dump.split("\n")[:10]:
            if "[" in line and "<" in line:
                try:
                    parts = line.strip().split("[")
                    if len(parts) >= 2:
                        condition = parts[1].split("]")[0]
                        feat_thresh = condition.split("<")
                        if len(feat_thresh) == 2:
                            feat_name = feat_thresh[0].strip()
                            threshold = float(feat_thresh[1].strip())
                            # Map feature index to name
                            if feat_name.startswith("f"):
                                idx = int(feat_name[1:])
                                feat_name = feature_names[idx] if idx < len(feature_names) else feat_name
                            value = float(sample[min(len(sample)-1, steps.__len__())])
                            steps.append({
                                "step": len(steps) + 1,
                                "feature": feat_name,
                                "threshold": round(threshold, 4),
                                "direction": "<",
                                "value": round(value, 4),
                                "result": value < threshold,
                            })
                except Exception:
                    continue
        return steps

    def _generate_synthetic_path(self, model, X_single, feature_names) -> List[Dict]:
        """Generate a synthetic decision path from feature importance."""
        importance = self.generate_feature_importance_json(model, feature_names)
        if not importance:
            return []

        steps = []
        top_features = list(importance.items())[:5]
        values = X_single.values[0] if hasattr(X_single, 'values') else X_single

        for i, (feat, imp) in enumerate(top_features):
            idx = feature_names.index(feat) if feat in feature_names else i
            val = float(values[idx]) if idx < len(values) else 0
            steps.append({
                "step": i + 1,
                "feature": feat,
                "importance": round(imp * 100, 1),
                "value": round(val, 4),
                "contribution": "positive" if imp > 0 else "negative",
            })

        return steps

    # ================================================================
    # Confidence Breakdown
    # ================================================================

    @staticmethod
    def generate_confidence_breakdown(model: Any, X_single: pd.DataFrame) -> Dict[str, Any]:
        """
        Generate class-by-class probability breakdown.
        """
        result = {"breakdown": [], "predicted_class": None, "confidence": None}

        try:
            if hasattr(model, "predict_proba"):
                proba = model.predict_proba(X_single)[0]
                classes = model.classes_ if hasattr(model, 'classes_') else list(range(len(proba)))

                breakdown = []
                for cls, prob in zip(classes, proba):
                    breakdown.append({
                        "class": str(cls),
                        "probability": round(float(prob) * 100, 2),
                    })

                # Sort by probability descending
                breakdown.sort(key=lambda x: x["probability"], reverse=True)

                result["breakdown"] = breakdown
                result["predicted_class"] = str(classes[np.argmax(proba)])
                result["confidence"] = round(float(max(proba)) * 100, 2)

            else:
                prediction = model.predict(X_single)[0]
                result["predicted_class"] = str(prediction)
                result["confidence"] = None

        except Exception as e:
            logger.error(f"Confidence breakdown failed: {e}")

        return result

    # ================================================================
    # Permutation Importance
    # ================================================================

    @staticmethod
    def generate_permutation_importance(
        model: Any, X: pd.DataFrame, y: np.ndarray,
        n_repeats: int = 5,
    ) -> Dict[str, float]:
        """
        Compute permutation-based feature importance.
        """
        try:
            from sklearn.inspection import permutation_importance

            if len(X) > 500:
                idx = np.random.choice(len(X), 500, replace=False)
                X_sample = X.iloc[idx]
                y_sample = y[idx] if isinstance(y, np.ndarray) else y.iloc[idx]
            else:
                X_sample = X
                y_sample = y

            result = permutation_importance(
                model, X_sample, y_sample,
                n_repeats=n_repeats, random_state=42, n_jobs=-1,
            )

            importance = {
                name: float(imp)
                for name, imp in zip(X.columns, result.importances_mean)
            }

            # Normalize
            total = sum(abs(v) for v in importance.values())
            if total > 0:
                importance = {k: abs(v) / total for k, v in importance.items()}

            return dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

        except Exception as e:
            logger.error(f"Permutation importance failed: {e}")
            return {}

    # ================================================================
    # Natural Language Explanation (AI Teacher Mode)
    # ================================================================

    @staticmethod
    def generate_natural_language_explanation(
        prediction: Any,
        confidence: float,
        feature_contributions: Dict[str, float],
        model_type: str,
        feature_values: Dict[str, Any] = None,
        decision_path: List[Dict] = None,
    ) -> str:
        """
        Generate a plain English explanation of why the model made this prediction.
        Uses template-based NL generation (no LLM required).
        """
        explanation_parts = []

        # 1. Opening statement
        conf_str = f"{confidence:.1f}%" if confidence else "N/A"
        explanation_parts.append(
            f"The model predicted **{prediction}** with a confidence of **{conf_str}**."
        )

        # 2. Model context
        explanation_parts.append(
            f"\n**Algorithm Used**: {model_type}"
        )

        # 3. Top contributing features
        if feature_contributions:
            sorted_features = sorted(feature_contributions.items(), key=lambda x: abs(x[1]), reverse=True)
            top_3 = sorted_features[:3]

            explanation_parts.append("\n**Key Factors in this Prediction:**")
            for i, (feat, contrib) in enumerate(top_3, 1):
                direction = "increased" if contrib > 0 else "decreased"
                pct = abs(contrib) * 100
                value_str = ""
                if feature_values and feat in feature_values:
                    value_str = f" (value: {feature_values[feat]})"
                explanation_parts.append(
                    f"{i}. **{feat}**{value_str} — {direction} the prediction likelihood by {pct:.1f}%"
                )

        # 4. Decision path summary
        if decision_path and len(decision_path) > 0:
            explanation_parts.append("\n**Decision Path:**")
            for step in decision_path[:5]:
                if "threshold" in step:
                    explanation_parts.append(
                        f"- Step {step['step']}: {step['feature']} {step['direction']} {step['threshold']} → "
                        f"{'TRUE' if step.get('result', True) else 'FALSE'}"
                    )
                elif "importance" in step:
                    explanation_parts.append(
                        f"- {step['feature']}: contributed {step['importance']}% to the prediction"
                    )

        # 5. Closing
        explanation_parts.append(
            f"\n**Summary**: The prediction is primarily driven by the top features listed above. "
            f"Similar patterns in the training data led the model to this conclusion."
        )

        return "\n".join(explanation_parts)
