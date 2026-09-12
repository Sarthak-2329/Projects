"""
Provider-agnostic LLM wrapper.

The entire point of this module is isolation: the rest of the codebase calls
generate_answer(prompt) and never cares whether the answer came from Gemini,
OpenAI, or Anthropic. Swapping providers means changing one env var, not
touching any calling code.

Configuration:
  Set ONE of these environment variables with a valid API key:
    - GEMINI_API_KEY   → uses Google Gemini (gemini-2.0-flash)
    - OPENAI_API_KEY   → uses OpenAI (gpt-4o-mini)
    - ANTHROPIC_API_KEY → uses Anthropic Claude (claude-3-5-haiku-20241022)

  Priority order: Gemini > OpenAI > Anthropic (first key found wins).
  Override with LLM_PROVIDER=gemini|openai|anthropic to force a specific one.
"""

import os
import httpx
from typing import Optional, Callable

# ---------------------------------------------------------------------------
# Override hook for testing.
#
# When set, generate_answer() calls this function instead of hitting any
# external API.  Tests inject a deterministic lambda here so they can run
# offline and still exercise prompt construction + citation parsing.
# ---------------------------------------------------------------------------
_override_fn: Optional[Callable[[str], str]] = None


def set_generate_override(fn: Optional[Callable[[str], str]]) -> None:
    """
    Inject a custom callable that replaces the real LLM call.
    Pass None to restore normal API behavior.
    """
    global _override_fn
    _override_fn = fn


# ---------------------------------------------------------------------------
# Provider implementations
# ---------------------------------------------------------------------------

def _call_gemini(prompt: str, api_key: str) -> str:
    """Call Google Gemini REST API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024}
    }
    response = httpx.post(url, json=payload, timeout=60.0)
    response.raise_for_status()
    data = response.json()
    # Navigate Gemini's nested response structure.
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _call_openai(prompt: str, api_key: str) -> str:
    """Call OpenAI Chat Completions API."""
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 1024
    }
    response = httpx.post(url, json=payload, headers=headers, timeout=60.0)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def _call_anthropic(prompt: str, api_key: str) -> str:
    """Call Anthropic Messages API."""
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    payload = {
        "model": "claude-3-5-haiku-20241022",
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}]
    }
    response = httpx.post(url, json=payload, headers=headers, timeout=60.0)
    response.raise_for_status()
    data = response.json()
    return data["content"][0]["text"]


# ---------------------------------------------------------------------------
# Public API — the ONE function the rest of the app calls.
# ---------------------------------------------------------------------------

def generate_answer(prompt: str) -> str:
    """
    Send a prompt to an LLM and return the raw text response.

    If a test override has been injected via set_generate_override(), that
    callable is used instead of any external API.

    Otherwise, the first available API key (Gemini → OpenAI → Anthropic)
    determines the provider.  Set LLM_PROVIDER to force a specific one.

    Raises:
        RuntimeError: If no API key is configured and no override is set.
    """
    # If a test override is active, skip all API logic.
    if _override_fn is not None:
        return _override_fn(prompt)

    # Determine which provider to use.
    forced_provider = os.environ.get("LLM_PROVIDER", "").lower()

    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")

    if forced_provider == "gemini" and gemini_key:
        return _call_gemini(prompt, gemini_key)
    elif forced_provider == "openai" and openai_key:
        return _call_openai(prompt, openai_key)
    elif forced_provider == "anthropic" and anthropic_key:
        return _call_anthropic(prompt, anthropic_key)
    elif not forced_provider:
        # Auto-detect: first key found wins.
        if gemini_key:
            return _call_gemini(prompt, gemini_key)
        if openai_key:
            return _call_openai(prompt, openai_key)
        if anthropic_key:
            return _call_anthropic(prompt, anthropic_key)

    raise RuntimeError(
        "No LLM API key configured. Set one of: "
        "GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY."
    )
