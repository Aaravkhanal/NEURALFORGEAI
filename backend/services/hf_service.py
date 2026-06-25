"""
NeuralForge — HuggingFace Dataset Service (Production)
Real HuggingFace API integration with dataset card enrichment,
preview loading for statistical analysis, and synthetic data generation.
"""

import os
import json
import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger("neuralforge.hf_service")


class HuggingFaceService:
    """Production HuggingFace API client with enrichment and preview capabilities."""

    def __init__(self, api_token: str = None):
        self.api_token = (
            api_token
            or os.environ.get("HF_TOKEN")
            or os.environ.get("HUGGINGFACE_API_TOKEN")
        )
        self.base_url = "https://huggingface.co/api"
        self.inference_url = "https://api-inference.huggingface.co/models"

    def _auth_headers(self) -> Dict[str, str]:
        headers = {}
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        return headers

    async def search_datasets(
        self, query: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search HuggingFace datasets with enriched metadata.
        Extracts card_data fields for samples, features, task categories.
        """
        params = {"search": query, "limit": min(limit, 20), "full": "true"}
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/datasets",
                    params=params,
                    headers=self._auth_headers(),
                    timeout=15.0,
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.error("Error searching HuggingFace datasets: %s", e)
            return []

        results = []
        for item in data[:limit]:
            dataset_id = item.get("id", "")
            card = item.get("cardData", {}) or {}
            tags = item.get("tags", [])

            # Extract task type from tags
            task_tags = [t for t in tags if t.startswith("task_categories:")]
            task_type = (
                task_tags[0].replace("task_categories:", "").replace("-", " ").title()
                if task_tags
                else "Unknown"
            )

            # Extract size category from tags
            size_tags = [t for t in tags if t.startswith("size_categories:")]
            size_str = (
                size_tags[0].replace("size_categories:", "")
                if size_tags
                else "Unknown"
            )

            # Extract language
            lang_tags = [t for t in tags if t.startswith("language:")]
            languages = [t.replace("language:", "") for t in lang_tags]

            # Try to extract number of rows from config
            num_rows = 0
            if card.get("dataset_info"):
                info = card["dataset_info"]
                if isinstance(info, list) and info:
                    splits = info[0].get("splits", [])
                elif isinstance(info, dict):
                    splits = info.get("splits", [])
                else:
                    splits = []
                for split in splits if isinstance(splits, list) else []:
                    num_rows += split.get("num_examples", 0)
                if isinstance(splits, dict):
                    for split_info in splits.values():
                        if isinstance(split_info, dict):
                            num_rows += split_info.get("num_examples", 0)

            # Extract features count
            num_features = 0
            if card.get("dataset_info"):
                info = card["dataset_info"]
                if isinstance(info, list) and info:
                    features = info[0].get("features", {})
                elif isinstance(info, dict):
                    features = info.get("features", {})
                else:
                    features = {}
                if isinstance(features, dict):
                    num_features = len(features)
                elif isinstance(features, list):
                    num_features = len(features)

            results.append({
                "id": dataset_id,
                "name": dataset_id,
                "description": item.get("description", "")[:500] or "No description available.",
                "source": "Hugging Face",
                "source_url": f"https://huggingface.co/datasets/{dataset_id}",
                "downloads": item.get("downloads", 0),
                "likes": item.get("likes", 0),
                "tags": tags,
                "task_type": task_type,
                "size": size_str,
                "license": card.get("license", "Unknown"),
                "languages": languages,
                "samples": num_rows,
                "features": num_features,
                "missing_pct": 0.0,  # Will be enriched by analyzer if preview loaded
            })

        return results

    async def get_dataset_info(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed dataset card information."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.base_url}/datasets/{dataset_id}",
                    headers=self._auth_headers(),
                    timeout=15.0,
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error("Error fetching HF dataset info for %s: %s", dataset_id, e)
            return None

    async def get_dataset_preview(
        self, dataset_id: str, split: str = "train", n_rows: int = 100
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Load preview rows from a HuggingFace dataset using the datasets viewer API.
        Returns list of row dicts or None on failure.
        """
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://datasets-server.huggingface.co/first-rows",
                    params={
                        "dataset": dataset_id,
                        "config": "default",
                        "split": split,
                    },
                    headers=self._auth_headers(),
                    timeout=20.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    rows = data.get("rows", [])
                    return [r.get("row", r) for r in rows[:n_rows]]

                # Try without config
                resp = await client.get(
                    "https://datasets-server.huggingface.co/first-rows",
                    params={"dataset": dataset_id, "split": split},
                    headers=self._auth_headers(),
                    timeout=20.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    rows = data.get("rows", [])
                    return [r.get("row", r) for r in rows[:n_rows]]

        except Exception as e:
            logger.warning("Could not load HF preview for %s: %s", dataset_id, e)

        return None

    async def generate_synthetic_data(
        self,
        prompt: str,
        dataset_type: str = "tabular",
        model_id: str = "meta-llama/Llama-3.1-8B-Instruct",
    ) -> str:
        """Use HF Inference API to generate synthetic data based on prompt."""
        url = f"{self.inference_url}/{model_id}"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

        system_instructions = {
            "tabular": "You are an expert synthetic data generator. You MUST output ONLY valid CSV text. Provide the header row first. No markdown formatting, no explanations, just raw CSV.",
            "nlp": "You are an expert NLP dataset generator. You MUST output ONLY valid CSV text with columns like 'text', 'label', 'instruction', 'response'. No markdown formatting, no explanations.",
            "text": "You are an expert NLP dataset generator. You MUST output ONLY valid CSV text with columns like 'text', 'label', 'instruction', 'response'. No markdown formatting, no explanations.",
            "time series": "You are an expert Time Series data generator. You MUST output ONLY valid CSV text. The first column MUST be a datetime or timestamp. No markdown formatting, no explanations.",
            "timeseries": "You are an expert Time Series data generator. You MUST output ONLY valid CSV text. The first column MUST be a datetime or timestamp. No markdown formatting, no explanations.",
            "image": "You are an expert Computer Vision metadata generator. Output ONLY valid CSV text containing 'image_filename', 'label', 'bounding_box', or 'prompt'. No markdown formatting.",
            "vision": "You are an expert Computer Vision metadata generator. Output ONLY valid CSV text containing 'image_filename', 'label', 'bounding_box', or 'prompt'. No markdown formatting.",
        }
        system_instruction = system_instructions.get(
            dataset_type.lower(),
            "You are an expert synthetic data generator. Output ONLY raw CSV text. No markdown formatting.",
        )

        payload = {
            "inputs": (
                f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
                f"{system_instruction}<|eot_id|>"
                f"<|start_header_id|>user<|end_header_id|>\n\n{prompt}<|eot_id|>"
                f"<|start_header_id|>assistant<|end_header_id|>\n\n"
            ),
            "parameters": {
                "max_new_tokens": 1500,
                "temperature": 0.7,
                "top_p": 0.9,
                "return_full_text": False,
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url, headers=headers, json=payload, timeout=60.0
                )

                if resp.status_code == 503:
                    logger.warning("HF Model is currently loading.")
                    return '{"error": "Model is loading on HF Server. Please try again in 30 seconds."}'

                resp.raise_for_status()
                data = resp.json()

                if isinstance(data, list) and len(data) > 0:
                    return data[0].get("generated_text", "")
                return str(data)
        except Exception as e:
            logger.error("Error generating data from HF Inference API: %s", e)
            raise


hf_service = HuggingFaceService()
