"""
NeuralForge — LLM Service
Multi-provider LLM client supporting OpenAI, Anthropic, and Groq via LangChain.
"""

import logging
from typing import Optional

from langchain_core.language_models import BaseChatModel

from core.config import get_settings

logger = logging.getLogger("neuralforge.llm")
settings = get_settings()


def get_llm(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.1,
    streaming: bool = False,
) -> BaseChatModel:
    """
    Get a LangChain chat model instance for the specified provider.

    Args:
        provider: LLM provider name (openai, anthropic, groq). Defaults to settings.
        model: Model name. Defaults to settings.
        temperature: Sampling temperature. Default 0.1 for deterministic outputs.
        streaming: Enable streaming mode. Default False.

    Returns:
        BaseChatModel: Configured LangChain chat model.

    Raises:
        ValueError: If no API key is configured for the requested provider.
    """
    provider = provider or settings.default_llm_provider
    model = model or settings.default_model_name

    # NVIDIA Model Mapping Catalog for specific agent roles
    NVIDIA_MODEL_MAP = {
        "agent_reasoning": "meta/llama-3.1-70b-instruct",
        "research": "meta/llama-3.1-70b-instruct",
        "code_generation": "meta/llama-3.1-70b-instruct",
        "rag": "meta/llama-3.1-70b-instruct",
        "summarization": "meta/llama-3.1-8b-instruct",
        "planning": "meta/llama-3.1-70b-instruct",
        "long_context": "meta/llama-3.1-70b-instruct",
    }

    if provider == "nvidia":
        if not settings.nvidia_api_key:
            raise ValueError("NVIDIA API key not configured. Set NVIDIA_API_KEY in .env")
        
        # Translate role to optimal NVIDIA model if matching key
        model = NVIDIA_MODEL_MAP.get(model, model)
        
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            streaming=streaming,
            api_key=settings.nvidia_api_key,
            base_url="https://integrate.api.nvidia.com/v1",
        )

    elif provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY in .env")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            streaming=streaming,
            api_key=settings.openai_api_key,
        )

    elif provider == "anthropic":
        if not settings.anthropic_api_key:
            raise ValueError("Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env")
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model if "claude" in model else "claude-sonnet-4-20250514",
            temperature=temperature,
            streaming=streaming,
            api_key=settings.anthropic_api_key,
        )

    elif provider == "groq":
        if not settings.groq_api_key:
            raise ValueError("Groq API key not configured. Set GROQ_API_KEY in .env")
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=model if model != "gpt-4o-mini" else "llama-3.3-70b-versatile",
            temperature=temperature,
            streaming=streaming,
            api_key=settings.groq_api_key,
        )

    else:
        raise ValueError(f"Unsupported LLM provider: {provider}. Supported: nvidia, openai, anthropic, groq")


def get_best_available_llm(
    temperature: float = 0.1,
    streaming: bool = False,
) -> BaseChatModel:
    """
    Get the best available LLM based on configured API keys.
    Priority: NVIDIA > OpenAI > Anthropic > Groq
    """
    providers = settings.get_available_providers()

    if not providers:
        raise ValueError(
            "No LLM providers configured. Set at least one of: "
            "NVIDIA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY"
        )

    for provider in ["nvidia", "openai", "anthropic", "groq"]:
        if provider in providers:
            logger.info(f"Using LLM provider: {provider}")
            return get_llm(provider=provider, temperature=temperature, streaming=streaming)

    return get_llm(provider=providers[0], temperature=temperature, streaming=streaming)
