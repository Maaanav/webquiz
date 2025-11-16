# backend/services.py
import hashlib
import json
import shutil
import re
import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor

# third-party
import aiofiles
from PyPDF2 import PdfReader

# SQLAlchemy
from sqlalchemy import Column, Integer, String, DateTime, create_engine, func
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.types import JSON as SA_JSON

# Pydantic
from pydantic import BaseModel, Field, validator, ValidationError

# optional GenAI client
try:
    from google import genai
except Exception:
    genai = None

# --- CONFIG / PATHS ---
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
QUESTIONS_FILE = BASE_DIR / "questions.json"
DB_FILE = BASE_DIR / "quizweb.db"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# --- Thread pool for blocking IO (shared) ---
executor = ThreadPoolExecutor(max_workers=4)

# ---------------------------
# Pydantic models for validation
# ---------------------------
class QuestionSchema(BaseModel):
    question: str
    options: List[str] = Field(..., min_items=4, max_items=4)
    correct_answer: str

    @validator("correct_answer")
    def correct_must_be_in_options(cls, v, values):
        opts = values.get("options", [])
        if v not in opts:
            raise ValueError("correct_answer must exactly match one of the options")
        return v

class QuizCreateSchema(BaseModel):
    title: Optional[str] = "Uploaded Quiz"
    questions: List[QuestionSchema] = Field(..., min_items=1)

class QuizOutSchema(BaseModel):
    id: int
    title: str
    questions: List[QuestionSchema]
    created_at: datetime.datetime

# ---------------------------
# SQLAlchemy setup (models + DB helpers)
# ---------------------------
Base = declarative_base()

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), default="Uploaded Quiz")
    questions = Column(SA_JSON, nullable=False)
    fingerprint = Column(String(64), nullable=True, index=True)  # sha256 hex fingerprint for dedupe
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, nullable=True)  # optional link to quiz
    score = Column(Integer, default=0)
    total = Column(Integer, default=0)
    answers = Column(SA_JSON, nullable=True)  # stores "detailed" array
    user = Column(SA_JSON, nullable=True)     # stores user info (name/email)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

DATABASE_URL = f"sqlite:///{DB_FILE}"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

def init_db():
    """
    Create tables. Call after removing old DB to apply model changes.
    """
    Base.metadata.create_all(bind=engine)

# ---------------------------
# PDF extraction (sync)
# ---------------------------
def extract_text_from_pdf_sync(path: Path) -> str:
    reader = PdfReader(str(path))
    text_parts = []
    for page in reader.pages:
        try:
            ptext = page.extract_text()
            if ptext:
                text_parts.append(ptext)
        except Exception:
            continue
    return "\n".join(text_parts)

# ---------------------------
# Clean & parse model output to JSON
# ---------------------------
def clean_and_parse_json_from_model(text: str):
    if text is None:
        raise ValueError("Model returned empty text")

    cleaned = re.sub(r"```(?:json)?", "", text)
    cleaned = re.sub(r"[\u0000-\u001F\u007F-\u009F]", "", cleaned)
    cleaned = cleaned.strip()

    if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1]

    if cleaned.startswith("{") or cleaned.startswith("["):
        try:
            parsed = json.loads(cleaned)
            return parsed
        except Exception:
            alt = cleaned.replace("'", '"')
            alt = re.sub(r",\s*([\]\}])", r"\1", alt)
            try:
                parsed = json.loads(alt)
                return parsed
            except Exception:
                match = re.search(r"($begin:math:display$.*$end:math:display$)", cleaned, re.DOTALL)
                if match:
                    try:
                        parsed = json.loads(match.group(1))
                        return parsed
                    except Exception:
                        pass
    raise ValueError("Failed to parse model output as JSON. Raw output (first 1000 chars):\n" + (cleaned[:1000] if cleaned else ""))

# ---------------------------
# GenAI wrapper (async-friendly)
# ---------------------------
async def generate_questions_from_text(context_text: str, max_questions: int = 10) -> Dict[str, Any]:
    """
    Uses google.genai if available. Returns dict {"message":..., "data":[{question...}]}
    If genai not configured, raises RuntimeError.
    """
    if genai is None:
        raise RuntimeError("GenAI client not available; install/configure google.genai or mock generation")

    client = genai.Client()
    prompt = (
        "Generate up to {n} multiple-choice questions with four options and exactly one correct answer "
        "for the following content. Return ONLY a JSON array of objects (no extra commentary). "
        "Each object should have the keys: question, options (array of 4 strings), correct_answer (string).\n\n"
        "Example output format:\n"
        '[{{\"question\":\"Q?\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct_answer\":\"A\"}}]\n\n'
        "Content:\n\n{content}"
    ).format(n=max_questions, content=context_text)

    try:
        model_name = "models/gemini-flash-latest"
        response = client.models.generate_content(model=model_name, contents=prompt)

        # defensive extraction of text
        model_text = None
        if hasattr(response, "text"):
            model_text = response.text
        else:
            model_text = getattr(response, "response", None)
            if model_text and hasattr(model_text, "text"):
                model_text = model_text.text
        if callable(model_text):
            model_text = model_text()

        if not model_text:
            raise RuntimeError("Empty response from GenAI model")

        parsed = clean_and_parse_json_from_model(model_text)

        if isinstance(parsed, dict) and parsed.get("questions"):
            parsed = parsed["questions"]
        if not isinstance(parsed, list):
            raise ValueError("Model JSON was not an array of questions")

        # Normalize to expected fields
        normalized = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            q = item.get("question") or item.get("q") or item.get("prompt")
            opts = item.get("options") or item.get("choices") or item.get("answers")
            correct = item.get("correct_answer") or item.get("answer") or item.get("correct")
            if not q or not isinstance(opts, list) or len(opts) != 4 or not correct:
                continue
            normalized.append({
                "question": q.strip(),
                "options": [str(o).strip() for o in opts],
                "correct_answer": str(correct).strip()
            })
            if len(normalized) >= max_questions:
                break

        return {"message": "Questions generated", "data": normalized}
    except Exception as e:
        raise RuntimeError(f"Error generating questions: {str(e)}")

# ---------------------------
# Fingerprint helper & DB helpers
# ---------------------------
def _questions_fingerprint(questions: List[Dict[str, Any]]) -> str:
    """
    Deterministic fingerprint for a question list.
    Uses JSON with sorted keys to get a stable representation, then sha256.
    """
    normalized = json.dumps(questions, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

def save_quiz_to_db_sync(title: str, questions: List[Dict[str, Any]]) -> int:
    """
    Save quiz to DB, but avoid inserting duplicates:
    - compute fingerprint of questions; if an existing Quiz has same fingerprint,
      return that existing id instead of inserting a new row.
    """
    session = SessionLocal()
    try:
        fp = _questions_fingerprint(questions)

        # look for existing quiz with same fingerprint
        existing = session.query(Quiz).filter(Quiz.fingerprint == fp).first()
        if existing:
            # optionally update title if current title is generic
            if title and (existing.title in (None, "", "Uploaded Quiz")) and title != existing.title:
                existing.title = title
                session.commit()
            return existing.id

        # create new quiz row
        q = Quiz(title=title, questions=questions, fingerprint=fp)
        session.add(q)
        session.commit()
        session.refresh(q)
        return q.id
    finally:
        session.close()

async def save_questions_and_db_async(title: str, questions: List[Dict[str, Any]]):
    # validate first (Pydantic)
    quiz_in = QuizCreateSchema(title=title, questions=questions)

    # write questions.json atomically (async)
    tmp_file = QUESTIONS_FILE.with_suffix(".tmp")
    async with aiofiles.open(tmp_file, "w", encoding="utf-8") as f:
        await f.write(json.dumps([q.dict() for q in quiz_in.questions], ensure_ascii=False, indent=2))

    # move file synchronously via executor
    loop = __import__("asyncio").get_event_loop()
    await loop.run_in_executor(executor, shutil.move, str(tmp_file), str(QUESTIONS_FILE))

    # persist to DB in executor (with dedupe)
    quiz_id = await loop.run_in_executor(executor, save_quiz_to_db_sync, quiz_in.title, [q.dict() for q in quiz_in.questions])
    return QuizOutSchema(id=quiz_id, title=quiz_in.title, questions=quiz_in.questions, created_at=datetime.datetime.utcnow())

# ---------------------------
# Result persistence helpers
# ---------------------------
# replace the existing save_result_sync with the following in backend/services.py

def save_result_sync(quiz_id: Optional[int], score: int, total: int, answers: List[Dict[str, Any]], user: Optional[Dict[str,Any]] = None, dedupe_window_seconds: int = 15) -> Dict[str, Any]:
    """
    Persist a quiz attempt (result) synchronously in the DB.
    If an identical attempt (same quiz_id, score, total, user, answers) was inserted within
    the last `dedupe_window_seconds`, return the existing row instead of creating a duplicate.
    """
    session = SessionLocal()
    try:
        # normalize user to a dict or None
        u = user if (user is None or isinstance(user, dict)) else {"raw": str(user)}

        # defensively stringify answers for comparison
        try:
            answers_norm = json.dumps(answers, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
        except Exception:
            # fallback: use str()
            answers_norm = str(answers)

        # compute time cutoff for duplicate detection
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(seconds=dedupe_window_seconds)

        # Query candidates: same quiz_id, score, total, created recently
        query = session.query(Result).filter(
            Result.score == score,
            Result.total == total,
            Result.created_at >= cutoff
        )
        if quiz_id is None:
            query = query.filter(Result.quiz_id.is_(None))
        else:
            query = query.filter(Result.quiz_id == quiz_id)

        candidates = query.order_by(Result.created_at.desc()).all()

        # compare candidates deeply (answers + user)
        for cand in candidates:
            # compare answers
            cand_answers = cand.answers
            try:
                cand_answers_norm = json.dumps(cand_answers, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
            except Exception:
                cand_answers_norm = str(cand_answers)

            if cand_answers_norm != answers_norm:
                continue

            # compare user (both may be dict or None or string)
            cand_user = cand.user
            # normalize cand_user to dict if JSON string
            if isinstance(cand_user, str):
                try:
                    cand_user_norm = json.loads(cand_user)
                except Exception:
                    cand_user_norm = {"raw": cand_user}
            else:
                cand_user_norm = cand_user

            # compare as JSON strings (robust)
            try:
                cand_user_str = json.dumps(cand_user_norm, sort_keys=True, ensure_ascii=False, separators=(',', ':')) if cand_user_norm is not None else "null"
                user_str = json.dumps(u, sort_keys=True, ensure_ascii=False, separators=(',', ':')) if u is not None else "null"
            except Exception:
                cand_user_str = str(cand_user_norm)
                user_str = str(u)

            if cand_user_str != user_str:
                continue

            # If we reached here, it's a matching recent attempt: return existing
            return {
                "id": cand.id,
                "quiz_id": cand.quiz_id,
                "score": cand.score,
                "total": cand.total,
                "answers": cand.answers,
                "user": cand.user,
                "created_at": cand.created_at.isoformat() if cand.created_at else None,
                "note": "returned existing result (deduped)"
            }

        # no duplicate found -> insert new row
        r = Result(quiz_id=quiz_id, score=score, total=total, answers=answers, user=u)
        session.add(r)
        session.commit()
        session.refresh(r)
        return {
            "id": r.id,
            "quiz_id": r.quiz_id,
            "score": r.score,
            "total": r.total,
            "answers": r.answers,
            "user": r.user,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
    finally:
        session.close()

def get_latest_result_sync() -> Optional[Dict[str, Any]]:
    """
    Return most recent saved result as dict, or None if none.
    """
    session = SessionLocal()
    try:
        r = session.query(Result).order_by(Result.created_at.desc()).first()
        if not r:
            return None
        return {
            "id": r.id,
            "quiz_id": r.quiz_id,
            "score": r.score,
            "total": r.total,
            "detailed": r.answers,    # named 'detailed' to match frontend expectation
            "user": r.user,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
    finally:
        session.close()