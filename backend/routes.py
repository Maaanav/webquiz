# backend/routes.py
import json
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import aiofiles
from pydantic import ValidationError

from services import (
    UPLOAD_DIR, QUESTIONS_FILE, executor,
    extract_text_from_pdf_sync, generate_questions_from_text,
    save_questions_and_db_async, SessionLocal, Quiz, func,
    save_result_sync, get_latest_result_sync, Result
)

router = APIRouter()

# ---- /quizzes (list + delete) ----
@router.get("/quizzes")
async def list_quizzes(limit: int = 50, offset: int = 0, q: Optional[str] = None):
    session = SessionLocal()
    try:
        query = session.query(Quiz)
        if q:
            like_term = f"%{q.lower()}%"
            query = query.filter(func.lower(Quiz.title).like(like_term))
        rows = query.order_by(Quiz.created_at.desc()).limit(limit).offset(offset).all()

        result = []
        for r in rows:
            try:
                qcount = len(r.questions) if isinstance(r.questions, list) else 0
            except Exception:
                qcount = 0
            result.append({
                "id": r.id,
                "title": r.title,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "question_count": qcount
            })
        return JSONResponse({"quizzes": result})
    finally:
        session.close()

@router.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: int):
    session = SessionLocal()
    try:
        q = session.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not q:
            return JSONResponse(status_code=404, content={"detail": "Quiz not found"})
        # optionally remove related results:
        session.query(Result).filter(Result.quiz_id == quiz_id).delete()
        session.delete(q)
        session.commit()
        return JSONResponse({"deleted": quiz_id})
    except Exception as e:
        session.rollback()
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        session.close()

# ---- /upload ----
@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDFs are allowed.")

    saved_path = UPLOAD_DIR / file.filename
    counter = 1
    base = saved_path.stem
    suffix = saved_path.suffix
    while saved_path.exists():
        saved_path = UPLOAD_DIR / f"{base}_{counter}{suffix}"
        counter += 1

    try:
        async with aiofiles.open(saved_path, "wb") as out_file:
            content = await file.read()
            await out_file.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}")

    try:
        loop = asyncio.get_event_loop()
        extracted_text = await loop.run_in_executor(executor, extract_text_from_pdf_sync, saved_path)

        if not extracted_text or len(extracted_text.strip()) == 0:
            try:
                saved_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise HTTPException(status_code=500, detail="No text extracted from PDF")

        gen_result = await generate_questions_from_text(extracted_text, max_questions=10)
        questions = gen_result.get("data", [])

        if not questions:
            try:
                saved_path.unlink(missing_ok=True)
            except Exception:
                pass
            raise HTTPException(status_code=500, detail="No questions generated")

        try:
            orig_name = getattr(file, "filename", "Uploaded Quiz")
            title_name = Path(orig_name).stem
            quiz_out = await save_questions_and_db_async(title=title_name, questions=questions)
        except ValidationError as ve:
            raise HTTPException(status_code=500, detail=f"Validation error for generated questions: {ve}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        try:
            saved_path.unlink(missing_ok=True)
        except Exception:
            pass

        return JSONResponse({"message": "File processed and questions generated successfully", "questions": [q.dict() for q in quiz_out.questions], "quiz_id": quiz_out.id})

    except HTTPException:
        raise
    except Exception as e:
        try:
            saved_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

# ---- /questions & /submit ----
@router.get("/questions")
async def get_questions(quiz_id: Optional[int] = None):
    if quiz_id is not None:
        session = SessionLocal()
        try:
            q = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not q:
                return JSONResponse(status_code=404, content={"message": "Quiz not found"})
            return JSONResponse({"message": "Quiz fetched", "quiz_id": q.id, "questions": q.questions})
        finally:
            session.close()

    if QUESTIONS_FILE.exists():
        async with aiofiles.open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
            content = await f.read()
        try:
            data = json.loads(content)
            if not isinstance(data, list) or len(data) == 0:
                return JSONResponse(status_code=400, content={"message": "No questions available"})
            return JSONResponse({"message": "File processed and questions generated successfully", "questions": data})
        except Exception:
            return JSONResponse(status_code=500, content={"message": "questions.json malformed"})
    else:
        return JSONResponse(status_code=400, content={"message": "No questions available"})

@router.post("/submit")
async def submit_answers(payload: Dict[str, Any]):
    answers = payload.get("answers")
    quiz_id = payload.get("quiz_id")  # optional
    user = payload.get("user")        # optional user info sent from frontend

    if not isinstance(answers, (dict, list)):
        raise HTTPException(status_code=400, detail="Invalid answers format")

    # load questions: prefer quiz_id from DB, else questions.json
    questions_data = None
    if quiz_id:
        session = SessionLocal()
        try:
            q = session.query(Quiz).filter(Quiz.id == quiz_id).first()
            if not q:
                raise HTTPException(status_code=400, detail="Quiz not found")
            questions_data = q.questions
        finally:
            session.close()
    else:
        if not QUESTIONS_FILE.exists():
            raise HTTPException(status_code=400, detail="No questions available to grade")
        async with aiofiles.open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
            content = await f.read()
        questions_data = json.loads(content)

    score = 0
    detailed: List[Dict[str, Any]] = []
    total_questions = len(questions_data)

    for idx, q in enumerate(questions_data):
        userAns = ""
        try:
            if isinstance(answers, list):
                userAns = (answers[idx] or "").strip()
            else:
                # accept either string keys or numeric keys
                userAns = str(answers.get(str(idx), answers.get(idx, ""))).strip()
        except Exception:
            userAns = ""

        # Normalize comparison for grading (case-insensitive)
        userAns_norm = userAns.strip().lower() if isinstance(userAns, str) else ""
        correct = str(q.get("correct_answer", "")).strip()
        correct_norm = correct.lower()

        is_correct = False
        if userAns_norm == "skipped question" or userAns == "":
            is_correct = False
        elif userAns_norm == correct_norm:
            score += 1
            is_correct = True

        # Build detailed entry for each question (text + selected + correct + isCorrect)
        detailed.append({
            "questionIndex": idx,
            "questionText": q.get("question", ""),
            "selected": userAns,
            "selectedText": userAns,
            "correct": correct,
            "correctText": correct,
            "isCorrect": is_correct,
            "explanation": q.get("explanation", "") if isinstance(q, dict) else ""
        })

    # persist result to DB using executor (sync function)
    try:
        loop = asyncio.get_event_loop()
        saved = await loop.run_in_executor(executor, save_result_sync, quiz_id, score, total_questions, detailed, user)
    except Exception as e:
        # If saving fails, still return the computed result (so frontend is not blocked)
        saved = {
            "score": score,
            "total": total_questions,
            "detailed": detailed,
            "error_saving": str(e)
        }

    # return the saved result (or computed if saving failed)
    response_payload = {
        "score": score,
        "total": total_questions,
        "detailed": detailed,
        "saved_result": saved
    }
    return JSONResponse(response_payload)

# ---- /results/latest ----
@router.get("/results/latest")
async def get_latest_result():
    """
    Return the most recent quiz result attempt (if any).
    """
    loop = asyncio.get_event_loop()
    try:
        latest = await loop.run_in_executor(executor, get_latest_result_sync)
        if not latest:
            return JSONResponse(status_code=404, content={"message": "No results found"})
        return JSONResponse(latest)
    except Exception as e:
        return JSONResponse(status_code=500, content={"message": f"Failed to fetch latest result: {e}"})

# ---- list results endpoint for admin ----
@router.get("/results")
async def list_results(quiz_id: Optional[int] = None, limit: int = 100, offset: int = 0):
    """
    Return a list of saved results (attempts). Optional: filter by quiz_id.
    This endpoint deduplicates attempts by a composed key so repeated identical attempts
    (same quiz, same user identifier, same score/total, same timestamp) won't appear multiple times.
    """
    session = SessionLocal()
    try:
        query = session.query(Result)
        if quiz_id is not None:
            query = query.filter(Result.quiz_id == quiz_id)

        # order by newest first, include id as tiebreaker
        rows = query.order_by(Result.created_at.desc(), Result.id.desc()).limit(limit).offset(offset).all()

        out = []
        seen_keys = set()
        for r in rows:
            # parse user field defensively (it may already be a dict or a JSON string)
            user_obj = r.user
            if isinstance(user_obj, str):
                try:
                    user_obj = json.loads(user_obj)
                except Exception:
                    user_obj = {"raw": user_obj}

            uname = ""
            if isinstance(user_obj, dict):
                uname = (user_obj.get("email") or user_obj.get("name") or user_obj.get("raw") or "").strip().lower()

            # create a dedupe key
            created_iso = r.created_at.isoformat() if r.created_at else ""
            dedupe_key = f"{r.quiz_id}|{uname}|{r.score}|{r.total}|{created_iso}"

            if dedupe_key in seen_keys:
                # skip duplicate attempt
                continue
            seen_keys.add(dedupe_key)

            out.append({
                "id": r.id,
                "quiz_id": r.quiz_id,
                "score": r.score,
                "total": r.total,
                "answers": r.answers,
                "user": user_obj,
                "created_at": created_iso
            })

        return JSONResponse({"results": out})
    finally:
        session.close()

# ---- delete a single result (admin) ----
@router.delete("/results/{result_id}")
async def delete_result(result_id: int):
    """
    Delete a single result row by id.
    """
    session = SessionLocal()
    try:
        r = session.query(Result).filter(Result.id == result_id).first()
        if not r:
            return JSONResponse(status_code=404, content={"detail": "Result not found"})
        session.delete(r)
        session.commit()
        return JSONResponse({"deleted_result": result_id})
    except Exception as e:
        session.rollback()
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        session.close()