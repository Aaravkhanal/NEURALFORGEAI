"""
Kaggle dataset search tool for dataset discovery.
"""

import logging
from typing import Optional

import httpx
from langchain_core.tools import tool

from core.config import get_settings

logger = logging.getLogger("neuralforge.tools.kaggle_search")
settings = get_settings()

async def search_kaggle(query: str, max_results: int = 5) -> list[dict]:
    """
    Search Kaggle datasets using Kaggle API.

    Args:
        query: Search query string.
        max_results: Maximum results to return.

    Returns:
        List of result dictionaries.
    """
    token = settings.kaggle_api_token
    if not token:
        logger.warning("No KAGGLE_API_TOKEN configured. Skipping Kaggle search.")
        return []

    try:
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            # Simple fallback for spaces in query
            encoded_query = httpx.URL(f"https://www.kaggle.com/api/v1/datasets/list?search={query}")
            response = await client.get(
                str(encoded_query),
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            results = []
            for r in data[:max_results]:
                title = r.get("titleNullable") or r.get("title") or "Unknown Kaggle Dataset"
                url = r.get("urlNullable") or r.get("url") or ""
                subtitle = r.get("subtitleNullable") or r.get("subtitle") or ""
                
                results.append({
                    "title": f"[Kaggle] {title}",
                    "url": url,
                    "content": f"{subtitle} - Source: Kaggle Datasets API",
                    "score": r.get("usabilityRatingNullable", 0),
                })
            return results

    except Exception as e:
        logger.error(f"Kaggle search error: {e}")
        return []

@tool("kaggle_search")
def kaggle_search_tool(query: str) -> str:
    """
    Search Kaggle for datasets related to machine learning topics.
    Use this tool to find real-world datasets for model training.

    Args:
        query: The search query.
    """
    import asyncio

    try:
        results = asyncio.run(search_kaggle(query, max_results=5))
    except RuntimeError:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            results = pool.submit(
                lambda: asyncio.run(search_kaggle(query, max_results=5))
            ).result()

    if not results:
        return "No Kaggle results found. Check query or API token."

    output = ""
    for r in results:
        output += f"### {r.get('title', 'Untitled')}\n"
        if r.get("url"):
            output += f"**URL**: {r['url']}\n"
        if r.get("content"):
            output += f"{r['content'][:500]}\n"
        output += "\n---\n\n"

    return output
