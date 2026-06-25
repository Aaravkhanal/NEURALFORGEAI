"""
Arxiv search tool for researcher agent.
Original credit: Team Paranoid Android (AINS Hackathon 2024)
"""

import logging
from typing import Optional

import arxiv
import fitz  # PyMuPDF
import httpx
from langchain_core.tools import tool

logger = logging.getLogger("neuralforge.tools.arxiv")
client = arxiv.Client()


def _download_and_extract_pdf(url: str, max_pages: int = 2) -> str:
    """Download a PDF and extract text from first few pages."""
    try:
        response = httpx.get(url, timeout=30.0, follow_redirects=True)
        response.raise_for_status()

        doc = fitz.open(stream=response.content, filetype="pdf")
        text = ""
        for page_num in range(min(max_pages, doc.page_count)):
            page = doc.load_page(page_num)
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        logger.warning(f"Failed to extract PDF from {url}: {e}")
        return ""


async def search_arxiv_papers(query: str, max_results: int = 10) -> list[dict]:
    """
    Search for research papers on arXiv.

    Args:
        query: Search query string.
        max_results: Maximum number of results to return.

    Returns:
        List of paper dictionaries with title, authors, summary, etc.
    """
    try:
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance,
        )
        results = client.results(search)

        papers = []
        for result in results:
            paper_text = _download_and_extract_pdf(result.pdf_url, max_pages=1)

            papers.append({
                "title": result.title,
                "authors": [author.name for author in result.authors],
                "summary": result.summary,
                "published": result.published.isoformat() if result.published else None,
                "pdf_url": result.pdf_url,
                "content_preview": paper_text[:1500] if paper_text else None,
                "categories": result.categories,
            })

        return papers

    except Exception as e:
        logger.error(f"ArXiv search error: {e}")
        return []


@tool("search_arxiv")
def search_arxiv_tool(query: str) -> str:
    """
    Search for research papers on arXiv and return formatted results.
    Use this tool to find academic papers, state-of-the-art methods, and benchmarks.

    Args:
        query: The search query for finding relevant papers.
    """
    import asyncio

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                papers = pool.submit(
                    lambda: asyncio.run(search_arxiv_papers(query, max_results=5))
                ).result()
        else:
            papers = asyncio.run(search_arxiv_papers(query, max_results=5))
    except Exception:
        papers = []
        # Fallback: synchronous search
        try:
            search = arxiv.Search(query=query, max_results=5, sort_by=arxiv.SortCriterion.Relevance)
            for result in client.results(search):
                papers.append({
                    "title": result.title,
                    "authors": [a.name for a in result.authors],
                    "summary": result.summary,
                    "pdf_url": result.pdf_url,
                })
        except Exception as e:
            return f"Error searching arXiv: {e}"

    if not papers:
        return "No papers found for the given query."

    output = ""
    for p in papers:
        output += f"## {p['title']}\n"
        output += f"**Authors**: {', '.join(p.get('authors', []))}\n\n"
        output += f"**Summary**: {p['summary'][:500]}...\n\n"
        if p.get('pdf_url'):
            output += f"[PDF Link]({p['pdf_url']})\n\n"
        output += "---\n\n"

    return output
