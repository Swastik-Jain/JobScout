"""
Centralised application settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Single source of truth for every environment variable.
Import `settings` instead of calling os.getenv() directly.
"""
from __future__ import annotations

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ── AI / Search APIs ──────────────────────────────────────────
    google_api_key: str = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    serper_api_key: str = os.getenv("SERPER_API_KEY", "")

    # ── Auth ──────────────────────────────────────────────────────
    secret_key: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # ── Database ──────────────────────────────────────────────────
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./jobscout.db")

    # ── CORS ──────────────────────────────────────────────────────
    @property
    def allowed_origins(self) -> list[str]:
        raw = os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,https://web-psi-dun-11.vercel.app"
        )
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
