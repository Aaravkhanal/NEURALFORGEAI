"""
NeuralForge — Training Transparency Service
Generates comprehensive training reports with data cleaning summary,
feature engineering details, model selection leaderboard, and exports to PDF/HTML/JSON.
"""

import os
import io
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

import numpy as np

logger = logging.getLogger("neuralforge.transparency")


class TransparencyService:
    """Generates complete training transparency reports."""

    @staticmethod
    def generate_training_report(
        model_name: str,
        task_type: str,
        metrics: Dict[str, float],
        dataset_info: Dict[str, Any],
        training_params: Dict[str, Any],
        feature_names: List[str] = None,
        feature_importance: Dict[str, float] = None,
        automl_results: Dict[str, Any] = None,
        training_job_info: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """
        Compile a complete training transparency report.
        """
        report = {
            "generated_at": datetime.now().isoformat(),
            "model_summary": {
                "model_name": model_name,
                "task_type": task_type,
                "algorithm": model_name,
                "metrics": metrics,
                "version": training_params.get("version", 1),
            },
            "dataset_summary": {
                "filename": dataset_info.get("filename", "Unknown"),
                "rows": dataset_info.get("rows"),
                "columns": dataset_info.get("columns"),
                "target_column": dataset_info.get("target"),
                "features_used": len(feature_names) if feature_names else dataset_info.get("columns", 0),
            },
            "data_cleaning": {
                "missing_values_handled": dataset_info.get("missing_values_removed", 0),
                "duplicates_removed": dataset_info.get("duplicates_removed", 0),
                "outliers_handled": dataset_info.get("outliers_handled", 0),
                "rows_before": dataset_info.get("rows_before", dataset_info.get("rows")),
                "rows_after": dataset_info.get("rows_after", dataset_info.get("rows")),
            },
            "feature_engineering": {
                "total_features": len(feature_names) if feature_names else 0,
                "feature_names": feature_names or [],
                "encoding_method": "Label Encoding (categorical)",
                "scaling_method": "Standard Scaler (numeric)",
                "missing_value_strategy": "Median (numeric) / Mode (categorical)",
            },
            "model_selection": {},
            "training_config": training_params,
            "feature_importance": feature_importance or {},
        }

        # AutoML leaderboard
        if automl_results and "leaderboard" in automl_results:
            leaderboard = automl_results["leaderboard"]
            report["model_selection"] = {
                "models_tested": [entry.get("model_name", "Unknown") for entry in leaderboard],
                "leaderboard": leaderboard,
                "winner": {
                    "model": model_name,
                    "reason": "Highest validation score based on primary metric",
                    "primary_metric": _get_primary_metric(task_type),
                },
            }
        else:
            report["model_selection"] = {
                "models_tested": [model_name],
                "winner": {
                    "model": model_name,
                    "reason": "Selected model",
                },
            }

        # Training job metadata
        if training_job_info:
            report["training_details"] = {
                "training_time_seconds": training_job_info.get("training_time_seconds"),
                "epochs": training_job_info.get("total_epochs"),
                "best_epoch": training_job_info.get("best_epoch"),
                "early_stopped": training_job_info.get("early_stopped", False),
                "training_curves": training_job_info.get("training_curves", {}),
            }

        return report

    @staticmethod
    def export_report_json(report: Dict) -> str:
        """Export report as formatted JSON string."""
        return json.dumps(report, indent=2, default=str)

    @staticmethod
    def export_report_html(report: Dict) -> str:
        """Export report as standalone HTML with embedded styling."""
        model = report.get("model_summary", {})
        dataset = report.get("dataset_summary", {})
        cleaning = report.get("data_cleaning", {})
        features = report.get("feature_engineering", {})
        selection = report.get("model_selection", {})
        importance = report.get("feature_importance", {})
        metrics = model.get("metrics", {})

        # Build feature importance bars
        importance_html = ""
        if importance:
            sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:15]
            for feat, imp in sorted_imp:
                pct = imp * 100
                importance_html += f"""
                <div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;">
                        <span>{feat}</span><span>{pct:.1f}%</span>
                    </div>
                    <div style="background:#1e1e2e;border-radius:4px;height:8px;overflow:hidden;">
                        <div style="background:linear-gradient(90deg,#7C3AED,#A78BFA);width:{pct}%;height:100%;border-radius:4px;"></div>
                    </div>
                </div>"""

        # Build metrics cards
        metrics_html = ""
        for k, v in metrics.items():
            if v is not None:
                metrics_html += f"""
                <div style="background:#1e1e2e;padding:16px;border-radius:12px;text-align:center;min-width:120px;">
                    <div style="font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">{k}</div>
                    <div style="font-size:24px;font-weight:700;color:#7C3AED;margin-top:4px;">{v:.4f}</div>
                </div>"""

        # Build leaderboard
        leaderboard_html = ""
        leaderboard = selection.get("leaderboard", [])
        if leaderboard:
            leaderboard_html = """<table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tr style="border-bottom:1px solid #374151;">
                    <th style="padding:8px;text-align:left;color:#9CA3AF;">Rank</th>
                    <th style="padding:8px;text-align:left;color:#9CA3AF;">Model</th>
                    <th style="padding:8px;text-align:right;color:#9CA3AF;">Score</th>
                    <th style="padding:8px;text-align:right;color:#9CA3AF;">Time</th>
                </tr>"""
            for i, entry in enumerate(leaderboard):
                is_winner = entry.get("model_name") == model.get("model_name")
                bg = "rgba(124,58,237,0.1)" if is_winner else "transparent"
                entry_metrics = entry.get("metrics", {})
                score = entry_metrics.get("accuracy", entry_metrics.get("r2", entry_metrics.get("f1", 0)))
                leaderboard_html += f"""
                <tr style="border-bottom:1px solid #1f2937;background:{bg};">
                    <td style="padding:8px;">{'🏆' if is_winner else i+1}</td>
                    <td style="padding:8px;font-weight:{'700' if is_winner else '400'};">{entry.get('model_name', 'Unknown')}</td>
                    <td style="padding:8px;text-align:right;color:#7C3AED;">{score:.4f}</td>
                    <td style="padding:8px;text-align:right;color:#6B7280;">{entry.get('training_time_sec', 0):.1f}s</td>
                </tr>"""
            leaderboard_html += "</table>"

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Training Report — {model.get('model_name', 'Model')}</title>
    <style>
        * {{ margin:0; padding:0; box-sizing:border-box; }}
        body {{ font-family:'Inter',-apple-system,sans-serif; background:#0f0f16; color:#E5E7EB; padding:40px; }}
        .container {{ max-width:900px; margin:0 auto; }}
        h1 {{ font-size:28px; font-weight:800; background:linear-gradient(135deg,#7C3AED,#A78BFA); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:8px; }}
        h2 {{ font-size:18px; font-weight:700; color:#D1D5DB; margin:32px 0 16px; padding-bottom:8px; border-bottom:1px solid #1f2937; }}
        .subtitle {{ color:#6B7280; font-size:14px; margin-bottom:32px; }}
        .card {{ background:#1a1a24; border:1px solid #2d2d3a; border-radius:16px; padding:24px; margin-bottom:16px; }}
        .metrics-grid {{ display:flex; gap:12px; flex-wrap:wrap; }}
        .stat {{ display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #1f2937; font-size:14px; }}
        .stat-label {{ color:#9CA3AF; }}
        .stat-value {{ color:#E5E7EB; font-weight:600; }}
        .badge {{ display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }}
        .badge-purple {{ background:rgba(124,58,237,0.15); color:#A78BFA; }}
        .footer {{ margin-top:40px; text-align:center; color:#4B5563; font-size:12px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🧠 Training Transparency Report</h1>
        <p class="subtitle">Model: {model.get('model_name')} | Task: {model.get('task_type')} | Generated: {report.get('generated_at', '')}</p>

        <h2>📊 Performance Metrics</h2>
        <div class="card">
            <div class="metrics-grid">{metrics_html}</div>
        </div>

        <h2>📁 Dataset Summary</h2>
        <div class="card">
            <div class="stat"><span class="stat-label">Dataset</span><span class="stat-value">{dataset.get('filename', 'N/A')}</span></div>
            <div class="stat"><span class="stat-label">Rows</span><span class="stat-value">{dataset.get('rows', 'N/A')}</span></div>
            <div class="stat"><span class="stat-label">Features</span><span class="stat-value">{dataset.get('features_used', 'N/A')}</span></div>
            <div class="stat"><span class="stat-label">Target Column</span><span class="stat-value">{dataset.get('target_column', 'N/A')}</span></div>
        </div>

        <h2>🧹 Data Cleaning</h2>
        <div class="card">
            <div class="stat"><span class="stat-label">Missing Values Handled</span><span class="stat-value">{cleaning.get('missing_values_handled', 0)}</span></div>
            <div class="stat"><span class="stat-label">Duplicates Removed</span><span class="stat-value">{cleaning.get('duplicates_removed', 0)}</span></div>
            <div class="stat"><span class="stat-label">Rows Before → After</span><span class="stat-value">{cleaning.get('rows_before', 'N/A')} → {cleaning.get('rows_after', 'N/A')}</span></div>
        </div>

        <h2>⚙️ Feature Engineering</h2>
        <div class="card">
            <div class="stat"><span class="stat-label">Total Features</span><span class="stat-value">{features.get('total_features', 0)}</span></div>
            <div class="stat"><span class="stat-label">Encoding</span><span class="stat-value">{features.get('encoding_method', 'N/A')}</span></div>
            <div class="stat"><span class="stat-label">Scaling</span><span class="stat-value">{features.get('scaling_method', 'N/A')}</span></div>
        </div>

        {"<h2>🏆 Model Selection Leaderboard</h2><div class='card'>" + leaderboard_html + "</div>" if leaderboard_html else ""}

        <h2>📈 Feature Importance</h2>
        <div class="card">{importance_html if importance_html else "<p style='color:#6B7280;'>Feature importance not available.</p>"}</div>

        <div class="footer">
            <p>Generated by NeuralForge AI Platform</p>
        </div>
    </div>
</body>
</html>"""
        return html

    @staticmethod
    def export_report_pdf(report: Dict) -> bytes:
        """Export report as PDF using reportlab."""
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.units import inch

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=40, bottomMargin=40)
            styles = getSampleStyleSheet()
            elements = []

            # Title
            title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=22, textColor=colors.HexColor("#7C3AED"))
            elements.append(Paragraph("Training Transparency Report", title_style))
            elements.append(Spacer(1, 12))

            model = report.get("model_summary", {})
            elements.append(Paragraph(f"Model: {model.get('model_name', 'N/A')} | Task: {model.get('task_type', 'N/A')}", styles['Normal']))
            elements.append(Paragraph(f"Generated: {report.get('generated_at', '')}", styles['Normal']))
            elements.append(Spacer(1, 20))

            # Metrics
            heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], textColor=colors.HexColor("#7C3AED"))
            elements.append(Paragraph("Performance Metrics", heading_style))
            elements.append(Spacer(1, 8))

            metrics = model.get("metrics", {})
            if metrics:
                metric_data = [["Metric", "Value"]]
                for k, v in metrics.items():
                    if v is not None:
                        metric_data.append([k.upper(), f"{v:.4f}"])
                if len(metric_data) > 1:
                    t = Table(metric_data, colWidths=[200, 200])
                    t.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#7C3AED")),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('FONTSIZE', (0, 0), (-1, -1), 10),
                        ('TOPPADDING', (0, 0), (-1, -1), 6),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ]))
                    elements.append(t)
                    elements.append(Spacer(1, 16))

            # Dataset
            elements.append(Paragraph("Dataset Summary", heading_style))
            elements.append(Spacer(1, 8))
            dataset = report.get("dataset_summary", {})
            for key in ["filename", "rows", "columns", "target_column", "features_used"]:
                val = dataset.get(key, "N/A")
                elements.append(Paragraph(f"<b>{key.replace('_', ' ').title()}</b>: {val}", styles['Normal']))
            elements.append(Spacer(1, 16))

            # Feature Importance
            importance = report.get("feature_importance", {})
            if importance:
                elements.append(Paragraph("Feature Importance", heading_style))
                elements.append(Spacer(1, 8))
                imp_data = [["Feature", "Importance"]]
                for feat, imp in sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]:
                    imp_data.append([feat, f"{imp*100:.1f}%"])
                t = Table(imp_data, colWidths=[250, 150])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#7C3AED")),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                elements.append(t)
                elements.append(Spacer(1, 16))

            # Footer
            elements.append(Spacer(1, 30))
            elements.append(Paragraph("Generated by NeuralForge AI Platform", ParagraphStyle('Footer', parent=styles['Normal'], textColor=colors.grey, fontSize=9, alignment=1)))

            doc.build(elements)
            buffer.seek(0)
            return buffer.getvalue()

        except ImportError:
            logger.warning("reportlab not installed, cannot generate PDF")
            return b""
        except Exception as e:
            logger.error(f"PDF generation failed: {e}")
            return b""


def _get_primary_metric(task_type: str) -> str:
    """Return the primary metric name for a task type."""
    if "classification" in task_type:
        return "f1"
    elif "regression" in task_type:
        return "r2"
    return "accuracy"
