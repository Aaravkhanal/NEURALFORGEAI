"""
NeuralForge — AI Training Coach Service
Generates epoch-by-epoch explanations, detects overfitting/underfitting,
and provides actionable recommendations during model training.
"""

import logging

logger = logging.getLogger("neuralforge.coach")


def generate_epoch_explanation(
    epoch: int,
    total_epochs: int,
    train_loss: float,
    val_loss: float,
    train_acc: float,
    val_acc: float,
    history: list[dict] | None = None,
) -> dict:
    """
    Generate a plain-English explanation of what happened this epoch.
    Returns status, explanation, indicators, and action recommendations.
    """
    history = history or []

    # ── Detect patterns ──────────────────────────────────
    status = "healthy"  # healthy | warning | danger
    alerts = []
    actions = []

    # Calculate trends from history
    prev_val_loss = history[-1]["val_loss"] if history else val_loss + 0.1
    prev_val_acc = history[-1].get("val_acc", val_acc - 1) if history else val_acc - 1
    prev_train_loss = history[-1]["train_loss"] if history else train_loss + 0.1

    loss_delta = val_loss - prev_val_loss
    acc_delta = val_acc - prev_val_acc
    gap = train_acc - val_acc

    # ── Overfitting Detection ────────────────────────────
    if gap > 15 and epoch > 3:
        status = "danger"
        alerts.append({
            "type": "overfitting",
            "severity": "high",
            "title": "⚠️ Overfitting Detected",
            "message": f"Training accuracy ({train_acc:.1f}%) is significantly higher than validation accuracy ({val_acc:.1f}%). The model is memorizing training data instead of learning generalizable patterns.",
            "actions": ["Stop Training", "Enable Early Stopping", "Increase Data Augmentation", "Add Dropout Regularization"],
        })
    elif gap > 8:
        status = "warning"
        alerts.append({
            "type": "overfitting_early",
            "severity": "medium",
            "title": "🟡 Early Overfitting Signs",
            "message": f"The gap between training ({train_acc:.1f}%) and validation ({val_acc:.1f}%) accuracy is growing. Watch for further divergence.",
            "actions": ["Monitor Next Epochs", "Consider Reducing Model Complexity"],
        })

    # ── Plateau Detection ────────────────────────────────
    if len(history) >= 5:
        recent_accs = [h.get("val_acc", 0) for h in history[-5:]]
        acc_range = max(recent_accs) - min(recent_accs)
        if acc_range < 0.5 and epoch > 5:
            status = "warning" if status != "danger" else status
            alerts.append({
                "type": "plateau",
                "severity": "medium",
                "title": "⏸️ Training Plateau Detected",
                "message": f"Validation accuracy has not improved significantly in the last 5 epochs (range: {acc_range:.2f}%). Further training may not yield meaningful improvements.",
                "actions": ["Stop Training", "Reduce Learning Rate", "Try Different Architecture"],
            })

    # ── Underfitting Detection ───────────────────────────
    if epoch > total_epochs // 2 and train_acc < 50 and val_acc < 50:
        status = "danger"
        alerts.append({
            "type": "underfitting",
            "severity": "high",
            "title": "📉 Underfitting Detected",
            "message": f"Both training ({train_acc:.1f}%) and validation ({val_acc:.1f}%) accuracy are low. The model may be too simple for this task.",
            "actions": ["Increase Model Complexity", "Add More Features", "Train Longer", "Check Data Quality"],
        })

    # ── Generate Explanation ─────────────────────────────
    phase = "early" if epoch <= total_epochs * 0.3 else "middle" if epoch <= total_epochs * 0.7 else "late"

    explanation_parts = []

    # Phase context
    if phase == "early":
        explanation_parts.append(f"**Epoch {epoch}/{total_epochs}** — The model is in its early learning phase, rapidly discovering patterns in your data.")
    elif phase == "middle":
        explanation_parts.append(f"**Epoch {epoch}/{total_epochs}** — The model is refining its understanding, making finer adjustments to improve accuracy.")
    else:
        explanation_parts.append(f"**Epoch {epoch}/{total_epochs}** — Late training phase. The model is fine-tuning its weights for optimal performance.")

    # Loss commentary
    if train_loss < prev_train_loss:
        improvement = ((prev_train_loss - train_loss) / prev_train_loss * 100)
        explanation_parts.append(f"Training loss decreased by {improvement:.1f}%, meaning the model is still learning effectively.")
    elif train_loss > prev_train_loss * 1.1:
        explanation_parts.append(f"Training loss increased slightly — this can happen when the learning rate is too high or the model encounters difficult samples.")
    else:
        explanation_parts.append(f"Training loss is relatively stable at {train_loss:.4f}.")

    # Accuracy commentary
    if acc_delta > 0:
        explanation_parts.append(f"Validation accuracy improved by {acc_delta:.1f}% to {val_acc:.1f}% — the model is generalizing better! 🎉")
    elif acc_delta < -1:
        explanation_parts.append(f"Validation accuracy dropped by {abs(acc_delta):.1f}%. This could indicate overfitting — the model might be memorizing training data.")
    else:
        explanation_parts.append(f"Validation accuracy is holding steady at {val_acc:.1f}%.")

    # Teaching moment
    teaching = _get_teaching_moment(epoch, total_epochs, phase, gap, status)

    return {
        "epoch": epoch,
        "total_epochs": total_epochs,
        "status": status,  # healthy | warning | danger
        "status_emoji": "🟢" if status == "healthy" else "🟡" if status == "warning" else "🔴",
        "explanation": "\n\n".join(explanation_parts),
        "alerts": alerts,
        "teaching": teaching,
        "metrics_summary": {
            "train_loss": train_loss,
            "val_loss": val_loss,
            "train_acc": train_acc,
            "val_acc": val_acc,
            "loss_trend": "↓ decreasing" if train_loss < prev_train_loss else "↑ increasing" if train_loss > prev_train_loss else "→ stable",
            "acc_trend": "↑ improving" if acc_delta > 0 else "↓ dropping" if acc_delta < -0.5 else "→ stable",
            "generalization_gap": gap,
        },
    }


def _get_teaching_moment(epoch: int, total: int, phase: str, gap: float, status: str) -> dict:
    """Generate a contextual teaching moment."""
    moments = {
        ("early", "healthy"): {
            "title": "💡 What's happening now?",
            "content": "The model is going through your data for the first few times. Think of it like a student reading a textbook — the first few reads establish basic understanding. The loss (error) should be decreasing rapidly at this stage.",
            "concept": "Training Loss",
            "definition": "Loss measures how wrong the model's predictions are. Lower loss = better predictions. During early training, loss drops quickly as the model learns obvious patterns."
        },
        ("middle", "healthy"): {
            "title": "💡 Learning is getting refined",
            "content": "The model has learned the obvious patterns and is now learning subtler distinctions. Progress slows down — this is normal! Think of it like going from learning basic words to understanding grammar.",
            "concept": "Validation Accuracy",
            "definition": "Validation accuracy measures how well the model performs on data it hasn't seen during training. This is the true test of learning — can the model generalize to new examples?"
        },
        ("late", "healthy"): {
            "title": "💡 Almost there!",
            "content": "The model is making final adjustments. Like an artist adding finishing touches, these small improvements can make a meaningful difference in real-world performance.",
            "concept": "Convergence",
            "definition": "When loss and accuracy stop changing significantly, the model has 'converged' — it has learned as much as it can from this data with this architecture."
        },
        ("middle", "warning"): {
            "title": "⚡ Understanding the warning",
            "content": "The gap between training and validation performance is growing. This is like a student who memorizes answers for a specific test but can't apply knowledge to new problems.",
            "concept": "Overfitting",
            "definition": "Overfitting happens when a model learns training data too well — including noise and irrelevant patterns — which hurts its ability to work on new data."
        },
    }

    key = (phase, status)
    return moments.get(key, moments[("early", "healthy")])


def detect_overfitting(history: list[dict]) -> dict:
    """
    Analyze full training history for overfitting patterns.
    Returns detection results with severity and recommendations.
    """
    if len(history) < 3:
        return {"detected": False, "severity": "none", "message": "Not enough data to analyze."}

    train_accs = [h.get("train_acc", 0) for h in history]
    val_accs = [h.get("val_acc", 0) for h in history]
    gaps = [t - v for t, v in zip(train_accs, val_accs)]

    # Check if gap is growing
    if len(gaps) >= 5:
        recent_gaps = gaps[-5:]
        early_gaps = gaps[:3]
        if sum(recent_gaps) / len(recent_gaps) > sum(early_gaps) / len(early_gaps) + 5:
            return {
                "detected": True,
                "severity": "high",
                "type": "progressive_overfitting",
                "message": "The generalization gap is progressively widening. Training accuracy continues to increase while validation accuracy stagnates or decreases.",
                "recommendation": "Stop training and use the model from the epoch with the best validation accuracy.",
                "best_epoch": val_accs.index(max(val_accs)) + 1,
            }

    # Check for validation accuracy decrease
    if len(val_accs) >= 5:
        peak_val_acc = max(val_accs)
        peak_epoch = val_accs.index(peak_val_acc)
        current_val_acc = val_accs[-1]
        if peak_epoch < len(val_accs) - 3 and current_val_acc < peak_val_acc - 2:
            return {
                "detected": True,
                "severity": "medium",
                "type": "accuracy_degradation",
                "message": f"Validation accuracy peaked at {peak_val_acc:.1f}% (epoch {peak_epoch + 1}) and has since declined to {current_val_acc:.1f}%.",
                "recommendation": f"Consider reverting to the model from epoch {peak_epoch + 1}.",
                "best_epoch": peak_epoch + 1,
            }

    # Check if gap is already large
    current_gap = gaps[-1] if gaps else 0
    if current_gap > 15:
        return {
            "detected": True,
            "severity": "high",
            "type": "large_gap",
            "message": f"There is a {current_gap:.1f}% gap between training and validation accuracy. The model is heavily overfitting.",
            "recommendation": "Apply regularization (dropout, weight decay) or increase your dataset size.",
            "best_epoch": val_accs.index(max(val_accs)) + 1,
        }

    return {"detected": False, "severity": "none", "message": "No overfitting detected. Training looks healthy! 🟢"}
