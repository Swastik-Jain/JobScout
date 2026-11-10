"""
Test suite for Phase 4: Resume Parsing Endpoint & Service
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verifies:
1. Clean PDF resume extraction & schema validation
2. Clean DOCX resume extraction (fresher with 0 experience)
3. Messy PDF resume with non-standard formatting & attention flags
4. Scanned / image-only PDF unreadable fallback handling
5. Type and size constraints (5MB limit, .pdf and .docx only)
6. Non-mutation: profile in database is untouched until user confirmation
"""
import io
import pytest
import docx
from fastapi.testclient import TestClient

from app.main import app
from app.services.resume_parser import (
    extract_text,
    extract_text_from_pdf,
    extract_text_from_docx,
    compute_confidence_and_attention,
    parse_resume_text,
    ParsedResumeData,
)


def create_pdf_bytes(text_lines):
    """Builds a valid PDF 1.4 byte stream containing the specified text lines."""
    stream_content = 'BT /F1 12 Tf 50 750 Td 14 TL '
    for line in text_lines:
        safe_line = line.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')
        stream_content += f'({safe_line}) \' '
    stream_content += 'ET'
    stream_bytes = stream_content.encode('latin1')
    
    pdf = f"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length {len(stream_bytes)} >>
stream
{stream_content}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000320 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
400
%%EOF
"""
    return pdf.encode('latin1')


def create_docx_bytes(paragraphs, tables=None):
    """Generates an in-memory DOCX file."""
    doc = docx.Document()
    for p in paragraphs:
        doc.add_paragraph(p)
    if tables:
        for t_rows in tables:
            t = doc.add_table(rows=len(t_rows), cols=len(t_rows[0]))
            for r_idx, row in enumerate(t_rows):
                for c_idx, cell in enumerate(row):
                    t.cell(r_idx, c_idx).text = cell
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


@pytest.fixture
def auth_client():
    """Client authenticated with a fresh user."""
    client = TestClient(app)
    email = f"parsetest_{id(client)}@example.com"
    reg = client.post("/auth/register", json={
        "name": "Alex Parser",
        "email": email,
        "password": "Password123!",
    })
    token = reg.json().get("token")
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


# ─── 1. Clean PDF (Experienced Engineer) ──────────────────────────────────────

def test_resume_parser_clean_pdf(auth_client):
    lines = [
        "Aarav Sharma",
        "aarav.sharma@example.com | +91 98765 43210 | Bengaluru, India",
        "Target Role: Senior Backend Engineer",
        "Professional Summary: Backend engineer with 3 years experience building distributed microservices.",
        "Skills: Python, FastAPI, PostgreSQL, Docker, Redis, Kubernetes, AWS, Git",
        "Work Experience:",
        "Razorpay - Software Development Engineer (2022 - Present)",
        "Designed payment settlement pipeline processing millions of daily transactions.",
        "Education:",
        "Bachelor of Technology in Computer Science",
        "National Institute of Technology Karnataka (NITK) - Graduated 2022",
        "Projects:",
        "Distributed Event Broker using Go and Kafka",
    ]
    pdf_bytes = create_pdf_bytes(lines)

    response = auth_client.post(
        "/resume/parse",
        files={"file": ("aarav_sharma_resume.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    parsed = data["parsed_data"]

    # Verify extracted entities
    assert "Aarav" in parsed["name"]
    assert "aarav.sharma@example.com" in parsed["email"]
    assert len(parsed["skills"]) >= 3
    assert any("Python" in s for s in parsed["skills"])

    # Education with grad year
    assert len(parsed["education"]) >= 1
    assert "2022" in str(parsed["education"][0]["year"])

    # High confidence on clean fields
    assert data["confidence"]["skills"] >= 0.7
    assert data["confidence"]["education"] >= 0.7


# ─── 2. Clean DOCX (Fresher With Zero Experience) ──────────────────────────────

def test_resume_parser_clean_docx_fresher(auth_client):
    paragraphs = [
        "Priya Verma",
        "priya.verma@college.edu | +91 91234 56789 | Delhi, India",
        "Aspiring Software Engineer & Full-Stack Developer",
        "Education:",
        "B.Tech in Information Technology - Delhi Technological University (DTU)",
        "Graduation Year: 2025",
        "Technical Skills: Python, JavaScript, TypeScript, React, Node.js, SQL, HTML, CSS",
        "Academic Projects:",
        "Job Portal AI - Automated job tracking system with React frontend and FastAPI backend",
        "Peer-to-Peer File Sharing Tool in Python",
    ]
    docx_bytes = create_docx_bytes(paragraphs)

    response = auth_client.post(
        "/resume/parse",
        files={"file": ("priya_verma_fresher.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    parsed = data["parsed_data"]

    assert "Priya" in parsed["name"]
    assert "priya.verma@college.edu" in parsed["email"]
    assert "2025" in str(parsed["education"][0]["year"])
    assert len(parsed["skills"]) >= 3

    # Fresher has no work experience — experience confidence remains high/neutral
    assert data["confidence"]["experience"] >= 0.8


# ─── 3. Messy PDF (Unconventional Formatting & Missing Year) ──────────────────

def test_resume_parser_messy_unconventional_pdf(auth_client):
    lines = [
        "--- RESUME OF DEV / HACKER ---",
        "handle: cipher_kid (IRFAN KHAN)",
        "reach me at irfan_dev99@gmail.com or ring 9811223344",
        "Location: Remote / Mumbai",
        "TECH I KNOW: python, django, rest, docker, bash, postgresql, git",
        "College: Mumbai University (Degree completed, year not listed on sheet)",
        "Did some freelancing and built a crypto arbitrage bot on GitHub.",
    ]
    pdf_bytes = create_pdf_bytes(lines)

    response = auth_client.post(
        "/resume/parse",
        files={"file": ("messy_unstructured_resume.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    parsed = data["parsed_data"]

    # Extracted contact & skills even from messy layout
    assert "irfan_dev99@gmail.com" in parsed["email"]
    assert any("python" in s.lower() or "django" in s.lower() for s in parsed["skills"])

    # Because graduation year was missing in text, attention_fields flags it for user verification
    assert "education.year" in data["attention_fields"] or "education" in data["attention_fields"]


# ─── 4. Scanned / Empty PDF (Fallback to Manual Entry) ─────────────────────────

def test_resume_parser_scanned_unreadable_pdf(auth_client):
    # Minimal PDF with < 50 characters (simulating an image-only scan)
    scanned_bytes = create_pdf_bytes(["[IMAGE SCAN]"])

    response = auth_client.post(
        "/resume/parse",
        files={"file": ("scanned_document.pdf", scanned_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    data = response.json()
    # Graceful fallback: success is False with clear error and empty skeleton for manual entry
    assert data["success"] is False
    assert "image scan or unreadable layout" in data["error"]
    assert data["parsed_data"] is not None
    assert isinstance(data["attention_fields"], list)


# ─── 5. Constraints: Unsupported Extension & Size Limit ───────────────────────

def test_resume_parser_unsupported_extension(auth_client):
    fake_txt = b"Some plain text resume"
    response = auth_client.post(
        "/resume/parse",
        files={"file": ("resume.txt", fake_txt, "text/plain")},
    )
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_resume_parser_size_limit(auth_client):
    # Over 5 MB
    large_payload = b"0" * (5 * 1024 * 1024 + 1024)
    response = auth_client.post(
        "/resume/parse",
        files={"file": ("oversized.pdf", large_payload, "application/pdf")},
    )
    assert response.status_code == 400
    assert "5MB size limit" in response.json()["detail"]


# ─── 6. Non-Mutation: UserProfile Untouched Before User Confirmation ──────────

def test_resume_parser_does_not_mutate_database_profile(auth_client):
    # Check profile before parsing
    before = auth_client.get("/profile/me").json()

    lines = [
        "Candidate X",
        "candx@example.com",
        "Skills: Python, Rust, Go",
        "Education: MIT, 2026",
    ]
    pdf_bytes = create_pdf_bytes(lines)

    auth_client.post(
        "/resume/parse",
        files={"file": ("test_resume.pdf", pdf_bytes, "application/pdf")},
    )

    # Check profile after parsing: must remain unchanged
    after = auth_client.get("/profile/me").json()
    assert before["skills"] == after["skills"]
    assert before["education"] == after["education"]
    assert before["profile_complete"] == after["profile_complete"]
