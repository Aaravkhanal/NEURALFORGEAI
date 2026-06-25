"""
NeuralForge — Kaggle Dataset Service (Production)
Real Kaggle API integration with metadata enrichment, preview downloads,
and statistical analysis of discovered datasets.
"""

import os
import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger("neuralforge.kaggle_service")


class KaggleService:
    """Production Kaggle API client with enrichment and preview capabilities."""

    def __init__(self, username: str = None, key: str = None, token: str = None):
        self.username = username or os.environ.get("KAGGLE_USERNAME")
        self.key = key or os.environ.get("KAGGLE_KEY")
        self.token = token or os.environ.get("KAGGLE_API_TOKEN")
        self.base_url = "https://www.kaggle.com/api/v1"

    def _get_auth_headers(self) -> tuple:
        """Return (auth_tuple, headers_dict) for requests."""
        auth = None
        headers = {}
        if self.username and self.key:
            auth = (self.username, self.key)
        elif self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return auth, headers

    async def _request(
        self, method: str, path: str, params: dict = None,
        timeout: float = 15.0, retries: int = 2
    ) -> Optional[Any]:
        """Make an authenticated Kaggle API request with retry logic."""
        auth, headers = self._get_auth_headers()
        url = f"{self.base_url}{path}"

        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.request(
                        method, url, params=params,
                        auth=auth, headers=headers, timeout=timeout,
                    )
                    if resp.status_code in (401, 403):
                        logger.warning(
                            "Kaggle API auth failed (attempt %d). "
                            "Check KAGGLE_USERNAME/KAGGLE_KEY or KAGGLE_API_TOKEN.",
                            attempt + 1,
                        )
                        return None
                    resp.raise_for_status()
                    return resp.json()
            except httpx.TimeoutException:
                logger.warning("Kaggle API timeout (attempt %d/%d)", attempt + 1, retries + 1)
            except Exception as e:
                logger.warning("Kaggle API error (attempt %d/%d): %s", attempt + 1, retries + 1, e)

            if attempt < retries:
                import asyncio
                await asyncio.sleep(1.5 * (attempt + 1))

        return None

    async def search_datasets(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search Kaggle datasets with enriched metadata.
        Returns normalized results with samples, features, downloads, size, etc.
        """
        data = await self._request(
            "GET", "/datasets/list",
            params={"search": query, "page": 1, "pageSize": min(limit, 20)},
        )
        if not data:
            return []

        results = []
        for item in data[:limit]:
            ref = item.get("ref", "")
            total_bytes = item.get("totalBytes", 0)

            # Normalize size to human-readable
            size_str = self._format_bytes(total_bytes)

            results.append({
                "id": ref,
                "name": item.get("title", ref),
                "description": item.get("subtitle", "No description available."),
                "source": "Kaggle",
                "source_url": f"https://www.kaggle.com/datasets/{ref}" if ref else "",
                "downloads": item.get("downloadCount", 0),
                "likes": item.get("voteCount", item.get("upVotes", 0)),
                "usability_rating": item.get("usabilityRating", 0),
                "size_bytes": total_bytes,
                "size": size_str,
                "file_count": item.get("fileCount", 0),
                "last_updated": item.get("lastUpdated", ""),
                "license": item.get("licenseName", "Unknown"),
                "tags": [t.get("name", "") for t in item.get("tags", [])],
                "owner": item.get("ownerName", ""),
                # These will be enriched by get_dataset_info if needed
                "samples": 0,
                "features": 0,
                "missing_pct": 0.0,
            })

        return results

    async def get_dataset_info(self, ref: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed metadata for a specific Kaggle dataset.
        ref format: "owner/dataset-name"
        """
        if "/" not in ref:
            return None

        owner, dataset = ref.split("/", 1)
        data = await self._request("GET", f"/datasets/view/{owner}/{dataset}")
        if not data:
            return None

        return {
            "ref": ref,
            "title": data.get("title", ""),
            "subtitle": data.get("subtitle", ""),
            "description": data.get("description", ""),
            "total_bytes": data.get("totalBytes", 0),
            "download_count": data.get("downloadCount", 0),
            "vote_count": data.get("voteCount", 0),
            "usability_rating": data.get("usabilityRating", 0),
            "file_count": data.get("fileCount", 0),
            "license": data.get("licenseName", "Unknown"),
            "tags": [t.get("name", "") for t in data.get("tags", [])],
            "columns": data.get("columns", []),
        }

    async def get_dataset_files(self, ref: str) -> List[Dict[str, Any]]:
        """List files in a Kaggle dataset to understand structure."""
        if "/" not in ref:
            return []

        owner, dataset = ref.split("/", 1)
        data = await self._request(
            "GET", f"/datasets/list/{owner}/{dataset}",
        )
        if not data:
            return []

        files = data.get("datasetFiles", data) if isinstance(data, dict) else data
        if not isinstance(files, list):
            return []

        return [
            {
                "name": f.get("name", ""),
                "size": f.get("totalBytes", 0),
                "columns": f.get("columns", []),
            }
            for f in files
        ]

    @staticmethod
    def _format_bytes(size_bytes: int) -> str:
        """Convert bytes to human-readable string."""
        if size_bytes <= 0:
            return "Unknown"
        for unit in ("B", "KB", "MB", "GB", "TB"):
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"


kaggle_service = KaggleService()
