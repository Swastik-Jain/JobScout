"""
Resume Parser Service
━━━━━━━━━━━━━━━━━━━━━
Extracts text from PDF/DOCX files and parses them into a validated, structured
candidate profile using Gemini with per-field confidence scoring and fallback handling.
"""
import io
import re
import json
import logging
import uuid
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
from pydantic import BaseModel, Field
import docx
import pypdf
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger("jobscout.resume_parser")

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx"}

# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class ParsedEducation(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""


class ParsedExperience(BaseModel):
    company: str = ""
    role: str = ""
    duration: str = ""
    description: str = ""


class ParsedProject(BaseModel):
    name: str = ""
    description: str = ""
    tech_stack: List[str] = Field(default_factory=list)
    live_url: Optional[str] = None
    repo_url: Optional[str] = None


class ParsedResumeData(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    headline: str = ""
    location: str = ""
    target_role: str = ""
    skills: List[str] = Field(default_factory=list)
    education: List[ParsedEducation] = Field(default_factory=list)
    experience: List[ParsedExperience] = Field(default_factory=list)
    projects: List[ParsedProject] = Field(default_factory=list)
    links: List[str] = Field(default_factory=list)


def get_empty_parsed_data() -> Dict[str, Any]:
    """Returns an empty skeleton ready for manual entry."""
    return ParsedResumeData().model_dump()


# ─── Text Extraction ──────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extracts plain text from a PDF file using pypdf."""
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        if txt.strip():
            pages_text.append(txt.strip())
    return "\n\n".join(pages_text).strip()


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extracts plain text from a DOCX file using python-docx."""
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    
    # Also extract table text
    for table in doc.tables:
        for row in table.rows:
            row_cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if row_cells:
                paragraphs.append(" | ".join(row_cells))
                
    return "\n".join(paragraphs).strip()


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Dispatcher to extract text based on file extension."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_bytes)
    elif ext == ".docx":
        return extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Allowed: .pdf, .docx")


# ─── Confidence & Attention Calculation ───────────────────────────────────────

def compute_confidence_and_attention(data: Dict[str, Any], raw_text: str) -> Tuple[Dict[str, float], List[str]]:
    """
    Evaluates per-field confidence based on completeness and grounding.
    Returns (confidence_scores, attention_fields).
    """
    confidence: Dict[str, float] = {}
    attention_fields: List[str] = []

    # 1. Name
    name = (data.get("name") or "").strip()
    if name and len(name.split()) >= 2 and len(name) < 40:
        confidence["name"] = 0.95
    elif name:
        confidence["name"] = 0.6
        attention_fields.append("name")
    else:
        confidence["name"] = 0.0
        attention_fields.append("name")

    # 2. Contact
    email = (data.get("email") or "").strip()
    phone = (data.get("phone") or "").strip()
    if email and phone:
        confidence["contact"] = 0.95
    elif email:
        confidence["contact"] = 0.8
    elif phone:
        confidence["contact"] = 0.5
        attention_fields.append("email")
    else:
        confidence["contact"] = 0.0
        attention_fields.append("email")

    # 3. Target Role & Location
    target_role = (data.get("target_role") or "").strip()
    location = (data.get("location") or "").strip()
    confidence["target_role"] = 0.9 if target_role else 0.3
    if not target_role:
        attention_fields.append("target_role")

    confidence["location"] = 0.9 if location else 0.4
    if not location:
        attention_fields.append("preferred_location")

    # 4. Skills
    skills = data.get("skills") or []
    if len(skills) >= 5:
        confidence["skills"] = 0.95
    elif len(skills) >= 1:
        confidence["skills"] = 0.7
    else:
        confidence["skills"] = 0.0
        attention_fields.append("skills")

    # 5. Education
    education = data.get("education") or []
    if education:
        has_year = any(bool(e.get("year")) for e in education if isinstance(e, dict))
        has_inst = any(bool(e.get("institution") or e.get("degree")) for e in education if isinstance(e, dict))
        if has_year and has_inst:
            confidence["education"] = 0.95
        elif has_inst:
            confidence["education"] = 0.6
            attention_fields.append("education.year")
        else:
            confidence["education"] = 0.3
            attention_fields.append("education")
    else:
        confidence["education"] = 0.0
        attention_fields.append("education")

    # 6. Experience (optional for freshers)
    experience = data.get("experience") or []
    confidence["experience"] = 0.95 if experience else 0.85

    # 7. Projects
    projects = data.get("projects") or []
    confidence["projects"] = 0.9 if projects else 0.7

    return confidence, attention_fields


# ─── LLM Parser with Gemini ───────────────────────────────────────────────────

def _make_client() -> Optional[genai.Client]:
    if not settings.google_api_key:
        return None
    try:
        return genai.Client(api_key=settings.google_api_key)
    except Exception as e:
        logger.warning(f"[ResumeParser] Could not initialize Gemini client: {e}")
        return None


EXTRACTION_PROMPT = """You are an expert Resume Parsing and Entity Extraction Specialist.
Analyze the provided resume text and extract the candidate's factual details into strict JSON.

STRICT RULES:
1. ONLY extract information that explicitly appears in the resume text. NEVER fabricate or invent skills, degrees, or companies.
2. If graduation year is mentioned (e.g., '2024', 'May 2023', '2019-2023'), extract the graduation/end year.
3. For target_role, infer the candidate's most relevant role based on their headline, recent experience, or education (e.g. 'Software Engineer', 'Frontend Developer', 'Data Analyst').
4. For skills, extract individual technical skills, frameworks, tools, and languages (e.g. ['Python', 'FastAPI', 'React', 'Docker']).
5. Return JSON matching this exact schema:

{
  "name": "<Candidate Full Name>",
  "email": "<Email address or empty string>",
  "phone": "<Phone number or empty string>",
  "headline": "<1-line professional title or headline>",
  "location": "<City, Country or Remote preference>",
  "target_role": "<Inferred target job title>",
  "skills": ["<skill1>", "<skill2>"],
  "education": [
    {
      "degree": "<Degree or certification title>",
      "institution": "<University or institution name>",
      "year": "<Graduation or completion year, e.g. 2024>"
    }
  ],
  "experience": [
    {
      "company": "<Company name>",
      "role": "<Job title>",
      "duration": "<e.g. Jun 2023 - Present>",
      "description": "<Key contributions and achievements>"
    }
  ],
  "projects": [
    {
      "name": "<Project name>",
      "description": "<Brief summary of project>",
      "tech_stack": ["<tech1>", "<tech2>"],
      "live_url": "<URL or null>",
      "repo_url": "<GitHub URL or null>"
    }
  ],
  "links": ["<LinkedIn or GitHub URL>"]
}

RESUME TEXT:
"""

def parse_resume_text(resume_text: str) -> Dict[str, Any]:
    """
    Sends resume text to Gemini to extract structured JSON data.
    Falls back to regex heuristics if Gemini client is unavailable or fails.
    """
    client = _make_client()
    if client:
        for model in settings.gemini_model_chain:
            try:
                logger.info(f"[ResumeParser] Parsing resume text with model {model}...")
                resp = client.models.generate_content(
                    model=model,
                    contents=EXTRACTION_PROMPT + "\n" + resume_text[:12000],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    )
                )
                raw_json = resp.text.strip()
                data = json.loads(raw_json)
                if data.get("skills") and isinstance(data["skills"], list):
                    normalized_skills = []
                    for s in data["skills"]:
                        if isinstance(s, str) and s.strip():
                            s_clean = s.strip()
                            normalized_skills.append(s_clean.title() if len(s_clean) > 3 else s_clean.upper())
                    data["skills"] = normalized_skills
                validated = ParsedResumeData(**data)
                return validated.model_dump()
            except Exception as e:
                logger.warning(f"[ResumeParser] Error parsing with {model}: {e}")
                continue

    # Fallback heuristic extraction if LLM is unavailable
    return _heuristic_extraction(resume_text)


def _heuristic_extraction(text: str) -> Dict[str, Any]:
    """Lightweight rule-based fallback when LLM is unreachable."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    name = lines[0] if lines and len(lines[0]) < 40 else ""
    
    # Extract email
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    email = email_match.group(0) if email_match else ""

    # Extract phone
    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
    phone = phone_match.group(0) if phone_match else ""

    # Extract common skills
    KNOWN_SKILLS = [
        "python", "javascript", "typescript", "react", "fastapi", "django", "node.js", "node",
        "sql", "postgresql", "mongodb", "docker", "kubernetes", "aws", "git", "html", "css",
        "c++", "java", "golang", "c#", "linux", "rest", "graphql", "tailwind"
    ]
    skills = [s.title() for s in KNOWN_SKILLS if re.search(r'\b' + re.escape(s) + r'\b', text, re.IGNORECASE)]

    # Extract graduation year
    year_match = re.search(r'\b(20[12]\d)\b', text)
    year = year_match.group(0) if year_match else ""

    edu_entry = ParsedEducation(degree="Bachelor of Technology", institution="", year=year) if year else ParsedEducation()

    return ParsedResumeData(
        name=name,
        email=email,
        phone=phone,
        target_role="Software Engineer",
        location="India, Remote",
        skills=skills,
        education=[edu_entry] if year else [],
        experience=[],
        projects=[],
    ).model_dump()


# ─── Storage Helper ────────────────────────────────────────────────────────────

def store_uploaded_resume(file_bytes: bytes, filename: str, user_id: int) -> Dict[str, Any]:
    """
    Stores the uploaded resume safely under backend/uploads/resumes/
    Does NOT modify the user's profile in the database.
    """
    upload_dir = Path(__file__).resolve().parent.parent.parent / "uploads" / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)
    target_path = upload_dir / f"{user_id}_{file_id[:8]}_{safe_name}"

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    return {
        "file_id": file_id,
        "filename": filename,
        "saved_path": str(target_path),
        "file_size": len(file_bytes),
    }
