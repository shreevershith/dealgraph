"""
Shared LLM model configuration for all DealGraph agents.

Returns a singleton model instance — all agents share one connection pool.

Supports multiple providers via the LLM_PROVIDER env var:
  - ollama    : Local inference (default for development)
  - groq      : Groq Cloud — free tier, hosts Llama 3.3 70B (recommended for deployment)
  - together  : Together.ai — hosts open-source models
  - openai    : OpenAI API (if you want GPT-4o, etc.)
"""

import os
from dotenv import load_dotenv

load_dotenv()

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower().strip()

_cached_model = None


def get_model():
    """Return a Strands-compatible model (cached singleton)."""
    global _cached_model
    if _cached_model is not None:
        return _cached_model

    if LLM_PROVIDER == "groq":
        from strands.models.openai import OpenAIModel

        _cached_model = OpenAIModel(
            model_id=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            client_args={
                "api_key": os.getenv("GROQ_API_KEY"),
                "base_url": "https://api.groq.com/openai/v1",
            },
        )

    elif LLM_PROVIDER == "together":
        from strands.models.openai import OpenAIModel

        _cached_model = OpenAIModel(
            model_id=os.getenv("TOGETHER_MODEL", "meta-llama/Llama-3.3-70B-Instruct"),
            client_args={
                "api_key": os.getenv("TOGETHER_API_KEY"),
                "base_url": "https://api.together.xyz/v1",
            },
        )

    elif LLM_PROVIDER == "openai":
        from strands.models.openai import OpenAIModel

        _cached_model = OpenAIModel(
            model_id=os.getenv("OPENAI_MODEL", "gpt-4o"),
            client_args={
                "api_key": os.getenv("OPENAI_API_KEY"),
            },
        )

    else:
        from strands.models.ollama import OllamaModel

        _cached_model = OllamaModel(
            host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
            model_id=os.getenv("OLLAMA_MODEL", "llama3.3"),
        )

    print(f"[DealGraph] LLM provider: {LLM_PROVIDER} (model cached)")
    return _cached_model
