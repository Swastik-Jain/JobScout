"""
Centralised application settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Single source of truth for every environment variable.
Import `settings` instead of calling os.getenv() directly.
"""
from __future__ import annotations

import os
from dotenv import load_dotenv

import secrets
import warnings

load_dotenv()


class Settings:
    # ── AI / Search APIs ──────────────────────────────────────────
    google_api_key: str = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    serper_api_key: str = os.getenv("SERPER_API_KEY", "")
    github_token: str = os.getenv("GITHUB_TOKEN", "")

    # ── AI Models ─────────────────────────────────────────────────
    gemini_primary_model: str = os.getenv("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash")
    gemini_lite_model: str = os.getenv("GEMINI_LITE_MODEL", "gemini-2.5-flash-lite")
    gemini_fallback_model: str = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-flash-latest")

    @property
    def gemini_model_chain(self) -> list[str]:
        raw = os.getenv("GEMINI_MODEL_CHAIN", "").strip()
        if raw:
            return [m.strip() for m in raw.split(",") if m.strip()]
        return [self.gemini_primary_model, self.gemini_lite_model, self.gemini_fallback_model]

    # ── Auth ──────────────────────────────────────────────────────
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    _ephemeral_secret: str = secrets.token_urlsafe(32)

    @property
    def secret_key(self) -> str:
        raw = os.getenv("SECRET_KEY", "").strip()
        insecure_defaults = ("", "super-secret-key-change-in-production", "change-this-to-a-long-random-secret")
        if not raw or raw in insecure_defaults:
            is_prod = bool(os.getenv("RENDER") or os.getenv("ENV") == "production")
            if is_prod:
                warnings.warn(
                    "SECURITY WARNING: Default or missing SECRET_KEY in production! Generating secure ephemeral key.",
                    stacklevel=2,
                )
                return self._ephemeral_secret
            return "insecure-dev-secret-only-for-local-testing"
        return raw

    # ── Database ──────────────────────────────────────────────────
    @property
    def database_url(self) -> str:
        url = os.getenv("DATABASE_URL", "sqlite:///./jobscout.db").strip()
        # Render / Heroku provides 'postgres://' which SQLAlchemy 1.4+ rejects; rewrite to 'postgresql://'
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # ── CORS ──────────────────────────────────────────────────────
    @property
    def allowed_origins(self) -> list[str]:
        raw = os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,https://web-psi-dun-11.vercel.app"
        )
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
