"""Groq and Gemini provider helpers with auto-prioritization."""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

from fastapi import HTTPException
from google import genai
from google.genai import types
from groq import Groq

CHARS_PER_TOKEN = 4

GROQ_REVIEW_MODEL = os.getenv("GROQ_REVIEW_MODEL", "llama-3.3-70b-versatile")
GEMINI_REVIEW_MODEL = os.getenv("GEMINI_REVIEW_MODEL", "gemini-2.0-flash")

GROQ_TIER = os.getenv("GROQ_TIER", "free").strip().lower()
GROQ_IS_FREE = GROQ_TIER not in {"dev", "paid", "pro"}

RATE_LIMIT_RETRIES = int(os.getenv("RATE_LIMIT_RETRIES", "2"))
RATE_LIMIT_BACKOFF_SECONDS = float(os.getenv("RATE_LIMIT_BACKOFF_SECONDS", "6"))


def _is_rate_limit_error(message: str) -> bool:
    lowered = message.lower()
    return (
        "429" in message
        or "resource_exhausted" in lowered
        or "rate_limit" in lowered
        or "rate limit" in lowered
        or "too many requests" in lowered
    )


def _retry_on_rate_limit(fn):
    """Run fn, retrying briefly on transient rate-limit errors (per-minute bursts)."""
    delay = RATE_LIMIT_BACKOFF_SECONDS
    for attempt in range(RATE_LIMIT_RETRIES + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 - re-raised after retries
            if attempt < RATE_LIMIT_RETRIES and _is_rate_limit_error(str(exc)):
                time.sleep(delay)
                delay *= 2
                continue
            raise


@dataclass(frozen=True)
class ProviderLimits:
    input_token_budget: int
    review_max_tokens: int
    chat_max_tokens: int
    max_text_chars: int
    max_text_overview: int
    max_reference_chars: int
    max_review_excerpt: int
    max_paper_excerpt: int
    max_journal_chars: int
    max_journal_excerpt: int
    max_questionnaire_chars: int
    max_questionnaire_excerpt: int
    use_compact_prompt: bool
    max_history: int


GEMINI_LIMITS = ProviderLimits(
    input_token_budget=500_000,
    review_max_tokens=4096,
    chat_max_tokens=2048,
    max_text_chars=int(os.getenv("GEMINI_MAX_TEXT_CHARS", "120000")),
    max_text_overview=int(os.getenv("GEMINI_MAX_TEXT_OVERVIEW", "60000")),
    max_reference_chars=int(os.getenv("GEMINI_MAX_REFERENCE_CHARS", "30000")),
    max_review_excerpt=8000,
    max_paper_excerpt=8000,
    max_journal_chars=int(os.getenv("GEMINI_MAX_JOURNAL_CHARS", "30000")),
    max_journal_excerpt=8000,
    max_questionnaire_chars=int(os.getenv("GEMINI_MAX_QUESTIONNAIRE_CHARS", "30000")),
    max_questionnaire_excerpt=8000,
    use_compact_prompt=False,
    max_history=20,
)

GROQ_LIMITS = ProviderLimits(
    input_token_budget=int(os.getenv("GROQ_INPUT_TOKEN_BUDGET", "5500" if GROQ_IS_FREE else "120000")),
    review_max_tokens=int(os.getenv("GROQ_REVIEW_MAX_TOKENS", "1536" if GROQ_IS_FREE else "4096")),
    chat_max_tokens=int(os.getenv("GROQ_CHAT_MAX_TOKENS", "1024" if GROQ_IS_FREE else "2048")),
    max_text_chars=int(os.getenv("MAX_TEXT_CHARS", "8000" if GROQ_IS_FREE else "120000")),
    max_text_overview=int(os.getenv("MAX_TEXT_OVERVIEW", "4000" if GROQ_IS_FREE else "60000")),
    max_reference_chars=int(os.getenv("MAX_REFERENCE_CHARS", "1500" if GROQ_IS_FREE else "40000")),
    max_review_excerpt=int(os.getenv("MAX_REVIEW_EXCERPT", "2500" if GROQ_IS_FREE else "8000")),
    max_paper_excerpt=int(os.getenv("MAX_PAPER_EXCERPT", "2500" if GROQ_IS_FREE else "8000")),
    max_journal_chars=int(os.getenv("MAX_JOURNAL_CHARS", "2000" if GROQ_IS_FREE else "40000")),
    max_journal_excerpt=int(os.getenv("MAX_JOURNAL_EXCERPT", "2500" if GROQ_IS_FREE else "8000")),
    max_questionnaire_chars=int(os.getenv("MAX_QUESTIONNAIRE_CHARS", "2000" if GROQ_IS_FREE else "40000")),
    max_questionnaire_excerpt=int(os.getenv("MAX_QUESTIONNAIRE_EXCERPT", "2500" if GROQ_IS_FREE else "8000")),
    use_compact_prompt=GROQ_IS_FREE,
    max_history=6 if GROQ_IS_FREE else 20,
)


class LLMProviderError(Exception):
    def __init__(self, message: str, status_code: int = 502, fallback_provider: str | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.fallback_provider = fallback_provider


_PLACEHOLDER_MARKERS = ("your_", "api_key_here", "changeme", "replace_me", "<", "xxxx")


def _real_key(value: str | None) -> str:
    """Return a usable API key, or '' for empty/placeholder values."""
    key = (value or "").strip()
    if not key:
        return ""
    lowered = key.lower()
    if any(marker in lowered for marker in _PLACEHOLDER_MARKERS):
        return ""
    return key


def has_groq_key(groq_key: str | None) -> bool:
    return bool(_real_key(groq_key) or _real_key(os.getenv("GROQ_API_KEY")))


def has_gemini_key(gemini_key: str | None) -> bool:
    return bool(
        _real_key(gemini_key)
        or _real_key(os.getenv("GEMINI_API_KEY"))
        or _real_key(os.getenv("GOOGLE_API_KEY"))
    )


def resolve_provider(preference: str, groq_key: str, gemini_key: str) -> str:
    pref = (preference or "auto").strip().lower()
    groq_ok = has_groq_key(groq_key)
    gemini_ok = has_gemini_key(gemini_key)

    if pref == "gemini":
        if not gemini_ok:
            raise HTTPException(
                status_code=400,
                detail="Gemini API key required. Get a free key at aistudio.google.com/apikey",
            )
        return "gemini"

    if pref == "groq":
        if not groq_ok:
            raise HTTPException(
                status_code=400,
                detail="Groq API key required. Get a key at console.groq.com/keys",
            )
        return "groq"

    # Auto: Gemini first — larger free context, better for full theses.
    if gemini_ok:
        return "gemini"
    if groq_ok:
        return "groq"

    raise HTTPException(
        status_code=400,
        detail="Enter a Gemini or Groq API key. Gemini is recommended for long papers (free at aistudio.google.com/apikey).",
    )


def fallback_provider(primary: str, preference: str, groq_key: str, gemini_key: str) -> str | None:
    if (preference or "auto").strip().lower() != "auto":
        return None
    if primary == "gemini" and has_groq_key(groq_key):
        return "groq"
    if primary == "groq" and has_gemini_key(gemini_key):
        return "gemini"
    return None


def get_limits(provider: str) -> ProviderLimits:
    return GEMINI_LIMITS if provider == "gemini" else GROQ_LIMITS


def get_text_limit(provider: str, review_depth: str) -> int:
    limits = get_limits(provider)
    if review_depth == "overview":
        return min(limits.max_text_overview, limits.max_text_chars)
    return limits.max_text_chars


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, (len(text) + CHARS_PER_TOKEN - 1) // CHARS_PER_TOKEN)


def truncate_to_token_budget(text: str, token_budget: int) -> tuple[str, bool]:
    if not text:
        return "", False
    if token_budget <= 0:
        return "", True
    max_chars = token_budget * CHARS_PER_TOKEN
    if len(text) <= max_chars:
        return text, False
    return text[:max_chars], True


def fit_review_content(
    provider: str,
    paper_text: str,
    reference_text: str,
    journal_text: str,
    questionnaire_text: str,
    review_depth: str,
    system_prompt: str,
) -> tuple[str, str, str, str, bool, bool, bool, bool]:
    limits = get_limits(provider)
    text_limit = get_text_limit(provider, review_depth)
    paper_truncated = len(paper_text) > text_limit
    paper_text = paper_text[:text_limit]

    ref_truncated = len(reference_text) > limits.max_reference_chars
    reference_text = reference_text[: limits.max_reference_chars]

    journal_truncated = len(journal_text) > limits.max_journal_chars
    journal_text = journal_text[: limits.max_journal_chars]

    questionnaire_truncated = len(questionnaire_text) > limits.max_questionnaire_chars
    questionnaire_text = questionnaire_text[: limits.max_questionnaire_chars]

    if provider == "gemini":
        return (
            paper_text,
            reference_text,
            journal_text,
            questionnaire_text,
            paper_truncated,
            ref_truncated,
            journal_truncated,
            questionnaire_truncated,
        )

    system_tokens = estimate_tokens(system_prompt)
    overhead_tokens = 350
    content_budget = limits.input_token_budget - system_tokens - overhead_tokens
    content_budget = max(content_budget, 1800)

    ref_budget = min(estimate_tokens(reference_text), max(200, content_budget // 10)) if reference_text else 0
    reference_text, ref_truncated = truncate_to_token_budget(reference_text, ref_budget)

    journal_budget = min(estimate_tokens(journal_text), max(200, content_budget // 10)) if journal_text else 0
    journal_text, journal_truncated = truncate_to_token_budget(journal_text, journal_budget)

    questionnaire_budget = (
        min(estimate_tokens(questionnaire_text), max(200, content_budget // 10)) if questionnaire_text else 0
    )
    questionnaire_text, questionnaire_truncated = truncate_to_token_budget(questionnaire_text, questionnaire_budget)

    paper_budget = (
        content_budget
        - estimate_tokens(reference_text)
        - estimate_tokens(journal_text)
        - estimate_tokens(questionnaire_text)
    )
    paper_budget = max(paper_budget, 1200)
    paper_text, paper_truncated = truncate_to_token_budget(paper_text, paper_budget)

    return (
        paper_text,
        reference_text,
        journal_text,
        questionnaire_text,
        paper_truncated,
        ref_truncated,
        journal_truncated,
        questionnaire_truncated,
    )


def trim_context_text(text: str, max_chars: int) -> str:
    cleaned = text.strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars]


def _groq_key(groq_key: str) -> str:
    key = _real_key(groq_key) or _real_key(os.getenv("GROQ_API_KEY"))
    if not key:
        raise LLMProviderError("Groq API key is missing.", status_code=400)
    return key


def _gemini_key(gemini_key: str) -> str:
    key = (
        _real_key(gemini_key)
        or _real_key(os.getenv("GEMINI_API_KEY"))
        or _real_key(os.getenv("GOOGLE_API_KEY"))
    )
    if not key:
        raise LLMProviderError(
            "Gemini API key is missing. Get a free key at aistudio.google.com/apikey",
            status_code=400,
        )
    return key


def _parse_groq_error(message: str) -> LLMProviderError:
    lowered = message.lower()
    if "invalid_api_key" in lowered or "401" in message:
        return LLMProviderError("Invalid Groq API key.", status_code=401)
    if "413" in message or "too large" in lowered or ("rate_limit" in lowered and "tpm" in lowered):
        return LLMProviderError(
            "Groq free tier limit reached for this request. Switch to Gemini (recommended) or use Quick overview with one chapter.",
            status_code=413,
            fallback_provider="gemini",
        )
    return LLMProviderError(f"Groq error: {message}", status_code=502)


def _parse_gemini_error(exc: Exception) -> LLMProviderError:
    message = str(exc)
    lowered = message.lower()
    if "api key" in lowered or "401" in message or "403" in message:
        return LLMProviderError(
            "Invalid Gemini API key. Get a free key at aistudio.google.com/apikey",
            status_code=401,
        )
    if "429" in message or "resource_exhausted" in lowered or "quota" in lowered:
        return LLMProviderError(
            "Gemini rate limit reached. Wait a minute or switch to Groq.",
            status_code=429,
            fallback_provider="groq",
        )
    return LLMProviderError(f"Gemini error: {message}", status_code=502)


def complete_review(
    provider: str,
    groq_key: str,
    gemini_key: str,
    system_prompt: str,
    user_prompt: str,
) -> tuple[str, str]:
    limits = get_limits(provider)
    if provider == "gemini":
        try:
            client = genai.Client(api_key=_gemini_key(gemini_key))
            response = _retry_on_rate_limit(
                lambda: client.models.generate_content(
                    model=GEMINI_REVIEW_MODEL,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.4,
                        max_output_tokens=limits.review_max_tokens,
                    ),
                )
            )
            text = (response.text or "").strip()
            if not text:
                raise LLMProviderError("Gemini returned an empty review.", status_code=502)
            return text, GEMINI_REVIEW_MODEL
        except LLMProviderError:
            raise
        except Exception as exc:
            raise _parse_gemini_error(exc) from exc

    try:
        client = Groq(api_key=_groq_key(groq_key))
        completion = _retry_on_rate_limit(
            lambda: client.chat.completions.create(
                model=GROQ_REVIEW_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
                max_tokens=limits.review_max_tokens,
            )
        )
        return completion.choices[0].message.content or "", GROQ_REVIEW_MODEL
    except LLMProviderError:
        raise
    except Exception as exc:
        raise _parse_groq_error(str(exc)) from exc


def complete_chat(
    provider: str,
    groq_key: str,
    gemini_key: str,
    system_prompt: str,
    context_prompt: str,
    history: list[dict[str, str]],
    message: str,
) -> tuple[str, str]:
    limits = get_limits(provider)
    history = history[-limits.max_history :]

    if provider == "gemini":
        try:
            client = genai.Client(api_key=_gemini_key(gemini_key))
            contents: list[types.Content] = []
            if context_prompt.strip():
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part(text=f"[Context]\n{context_prompt.strip()}")],
                    )
                )
                contents.append(
                    types.Content(
                        role="model",
                        parts=[types.Part(text="Understood. I have the paper and review context.")],
                    )
                )
            for item in history:
                role = "user" if item["role"] == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=item["content"])]))
            contents.append(types.Content(role="user", parts=[types.Part(text=message.strip())]))

            response = _retry_on_rate_limit(
                lambda: client.models.generate_content(
                    model=GEMINI_REVIEW_MODEL,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.5,
                        max_output_tokens=limits.chat_max_tokens,
                    ),
                )
            )
            text = (response.text or "").strip()
            if not text:
                raise LLMProviderError("Gemini returned an empty reply.", status_code=502)
            return text, GEMINI_REVIEW_MODEL
        except LLMProviderError:
            raise
        except Exception as exc:
            raise _parse_gemini_error(exc) from exc

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    if context_prompt.strip():
        context_budget = max(800, limits.input_token_budget // 3)
        trimmed, _ = truncate_to_token_budget(context_prompt, context_budget)
        messages.append({"role": "system", "content": trimmed})
    messages.extend(history)
    messages.append({"role": "user", "content": message.strip()})

    try:
        client = Groq(api_key=_groq_key(groq_key))
        completion = _retry_on_rate_limit(
            lambda: client.chat.completions.create(
                model=GROQ_REVIEW_MODEL,
                messages=messages,
                temperature=0.5,
                max_tokens=limits.chat_max_tokens,
            )
        )
        return completion.choices[0].message.content or "", GROQ_REVIEW_MODEL
    except LLMProviderError:
        raise
    except Exception as exc:
        raise _parse_groq_error(str(exc)) from exc


def run_with_fallback(
    preference: str,
    groq_key: str,
    gemini_key: str,
    task: str,
    system_prompt: str,
    user_prompt: str = "",
    context_prompt: str = "",
    history: list[dict[str, str]] | None = None,
    message: str = "",
) -> tuple[str, str, str]:
    """Returns (text, model_name, provider_used)."""
    primary = resolve_provider(preference, groq_key, gemini_key)
    providers_to_try = [primary]
    fb = fallback_provider(primary, preference, groq_key, gemini_key)
    if fb:
        providers_to_try.append(fb)

    last_error: LLMProviderError | None = None
    for idx, provider in enumerate(providers_to_try):
        try:
            if task == "review":
                text, model = complete_review(provider, groq_key, gemini_key, system_prompt, user_prompt)
            else:
                text, model = complete_chat(
                    provider,
                    groq_key,
                    gemini_key,
                    system_prompt,
                    context_prompt,
                    history or [],
                    message,
                )
            return text, model, provider
        except LLMProviderError as exc:
            last_error = exc
            # In Auto mode, if another provider is still available, try it on
            # ANY failure (invalid key, quota, server error) — not just rate
            # limits. This lets a valid Groq key work even when the preferred
            # Gemini key is missing, a placeholder, or invalid.
            if idx + 1 < len(providers_to_try):
                continue
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    if last_error:
        raise HTTPException(status_code=last_error.status_code, detail=last_error.message)
    raise HTTPException(status_code=502, detail="AI request failed.")
