"""
Web search tools for researcher agent.
"""

import logging
from typing import Optional

import httpx
from langchain_core.tools import tool

from core.config import get_settings

logger = logging.getLogger("neuralforge.tools.web_search")
settings = get_settings()


async def search_web(query: str, max_results: int = 5) -> list[dict]:
    """
    Perform web search using available provider (Tavily > Jina).

    Args:
        query: Search query string.
        max_results: Maximum results to return.

    Returns:
        List of result dictionaries.
    """
    if settings.tavily_api_key:
        return await _search_tavily(query, max_results)
    elif settings.jina_api_key:
        return await _search_jina(query, max_results)
    else:
        logger.warning("No search API configured (TAVILY_API_KEY or JINA_API_KEY)")
        return []


async def _search_tavily(query: str, max_results: int = 5) -> list[dict]:
    """Search using Tavily API."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "include_raw_content": False,
                },
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()

            return [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", ""),
                    "score": r.get("score", 0),
                }
                for r in data.get("results", [])
            ]
    except Exception as e:
        logger.error(f"Tavily search error: {e}")
        return []


async def _search_jina(query: str, max_results: int = 5) -> list[dict]:
    """
    Search using Jina AI Searcher API.
    """
    try:
        async with httpx.AsyncClient() as client:
            encoded_query = httpx.URL(f"https://s.jina.ai/{query}")
            headers = {"Authorization": f"Bearer {settings.jina_api_key}"}

            response = await client.get(str(encoded_query), headers=headers, timeout=30.0)

            if response.status_code == 402:
                logger.error("Jina API: Payment required")
                return []

            response.raise_for_status()
            results_text = response.text.split("\n")

            results = []
            current_result = {}
            for line in results_text:
                if "Title:" in line:
                    if current_result:
                        results.append(current_result)
                        if len(results) >= max_results:
                            break
                    current_result = {"title": line.split("Title:", 1)[1].strip()}
                elif "URL Source:" in line:
                    url_start = line.find("https://")
                    if url_start != -1:
                        current_result["url"] = line[url_start:].split()[0]
                elif line.strip() and "title" in current_result:
                    current_result.setdefault("content", "")
                    current_result["content"] += line.strip() + " "

            if current_result:
                results.append(current_result)

            return results[:max_results]

    except Exception as e:
        logger.error(f"Jina search error: {e}")
        return []


@tool("web_search")
def web_search_tool(query: str) -> str:
    """
    Search the web for information about machine learning topics, solutions, and best practices.
    Use this tool to find practical implementations, tutorials, and real-world examples.

    Args:
        query: The search query.
    """
    import asyncio

    try:
        results = asyncio.run(search_web(query, max_results=5))
    except RuntimeError:
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            results = pool.submit(
                lambda: asyncio.run(search_web(query, max_results=5))
            ).result()

    if not results:
        return "No web results found. Try a different query or check API key configuration."

    output = ""
    for r in results:
        output += f"### {r.get('title', 'Untitled')}\n"
        if r.get("url"):
            output += f"**URL**: {r['url']}\n"
        if r.get("content"):
            output += f"{r['content'][:500]}\n"
        output += "\n---\n\n"

    return output
