"""
NeuralForge — OpenML Dataset Service (Production)
Real OpenML API integration with multi-word search, quality measures,
and proper metadata extraction.
"""

import os
import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger("neuralforge.openml_service")


class OpenMLService:
    """Production OpenML API client with enriched dataset metadata."""

    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get("OPENML_API_KEY")
        self.base_url = "https://www.openml.org/api/v1/json"

    def _params(self) -> dict:
        p = {}
        if self.api_key:
            p["api_key"] = self.api_key
        return p

    async def search_datasets(
        self, query: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search OpenML datasets using multiple strategies:
        1. Try exact data_name match on each word
        2. Try tag-based search
        3. Fallback to listing active datasets and filtering
        """
        results: List[Dict[str, Any]] = []
        seen_ids = set()

        # Strategy 1: Search by each significant keyword
        keywords = [w.lower() for w in query.split() if len(w) > 2]
        for keyword in keywords[:3]:  # Limit to 3 keywords to avoid too many requests
            try:
                url = f"{self.base_url}/data/list/data_name/{keyword}/limit/{limit}"
                async with httpx.AsyncClient() as client:
                    resp = await client.get(
                        url, params=self._params(), timeout=10.0
                    )
                    if resp.status_code == 412:
                        continue  # No results for this keyword
                    resp.raise_for_status()
                    data = resp.json()

                    datasets = data.get("data", {}).get("dataset", [])
                    for item in datasets:
                        did = item.get("did")
                        if did and did not in seen_ids:
                            seen_ids.add(did)
                            results.append(self._normalize_item(item))
                            if len(results) >= limit:
                                break
            except Exception as e:
                logger.debug("OpenML keyword search for '%s' failed: %s", keyword, e)

            if len(results) >= limit:
                break

        # Strategy 2: Search by tag if we have few results
        if len(results) < limit:
            for keyword in keywords[:2]:
                try:
                    url = f"{self.base_url}/data/list/tag/{keyword}/limit/{limit - len(results)}"
                    async with httpx.AsyncClient() as client:
                        resp = await client.get(
                            url, params=self._params(), timeout=10.0
                        )
                        if resp.status_code == 412:
                            continue
                        resp.raise_for_status()
                        data = resp.json()

                        datasets = data.get("data", {}).get("dataset", [])
                        for item in datasets:
                            did = item.get("did")
                            if did and did not in seen_ids:
                                seen_ids.add(did)
                                results.append(self._normalize_item(item))
                                if len(results) >= limit:
                                    break
                except Exception as e:
                    logger.debug("OpenML tag search for '%s' failed: %s", keyword, e)

                if len(results) >= limit:
                    break

        return results[:limit]

    async def get_dataset_qualities(self, did: int) -> Dict[str, Any]:
        """
        Fetch OpenML quality measures for a dataset.
        Returns metrics like NumberOfInstances, NumberOfFeatures,
        NumberOfMissingValues, NumberOfClasses, etc.
        """
        try:
            url = f"{self.base_url}/data/qualities/{did}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    url, params=self._params(), timeout=10.0
                )
                if resp.status_code != 200:
                    return {}
                data = resp.json()

                qualities = {}
                quality_list = (
                    data.get("data_qualities", {}).get("quality", [])
                )
                for q in quality_list:
                    name = q.get("name", "")
                    value = q.get("value", "")
                    try:
                        qualities[name] = float(value)
                    except (ValueError, TypeError):
                        qualities[name] = value

                return qualities
        except Exception as e:
            logger.warning("Failed to fetch OpenML qualities for did=%s: %s", did, e)
            return {}

    async def get_dataset_description(self, did: int) -> Optional[Dict[str, Any]]:
        """Get full dataset description from OpenML."""
        try:
            url = f"{self.base_url}/data/{did}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    url, params=self._params(), timeout=10.0
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("data_set_description", {})
        except Exception as e:
            logger.warning("Failed to fetch OpenML description for did=%s: %s", did, e)
            return None

    def _normalize_item(self, item: dict) -> Dict[str, Any]:
        """Normalize an OpenML dataset list item to our standard format."""
        did = item.get("did", 0)
        name = item.get("name", f"OpenML-{did}")
        n_instances = self._safe_int(item.get("NumberOfInstances", 0))
        n_features = self._safe_int(item.get("NumberOfFeatures", 0))
        n_classes = self._safe_int(item.get("NumberOfClasses", 0))
        n_missing = self._safe_int(item.get("NumberOfMissingValues", 0))
        fmt = item.get("format", "ARFF")

        # Calculate missing percentage
        total_cells = n_instances * n_features if n_instances and n_features else 1
        missing_pct = round((n_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0

        return {
            "id": str(did),
            "name": name,
            "description": f"OpenML dataset '{name}' with {n_instances:,} instances, {n_features} features. Format: {fmt}.",
            "source": "OpenML",
            "source_url": f"https://www.openml.org/d/{did}",
            "downloads": 0,
            "likes": 0,
            "samples": n_instances,
            "features": n_features,
            "classes": n_classes,
            "missing_values": n_missing,
            "missing_pct": missing_pct,
            "format": fmt,
            "size": f"{n_instances:,} rows × {n_features} cols",
        }

    @staticmethod
    def _safe_int(val) -> int:
        try:
            return int(float(val)) if val else 0
        except (ValueError, TypeError):
            return 0


openml_service = OpenMLService()
