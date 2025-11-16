# backend/cleanup_duplicates.py
from services import SessionLocal, Result
import json

def make_user_key(u):
    if not u:
        return ""
    if isinstance(u, str):
        try:
            u = json.loads(u)
        except Exception:
            return u.strip().lower()
    if isinstance(u, dict):
        return (u.get("email") or u.get("name") or u.get("raw") or "").strip().lower()
    return str(u).strip().lower()

def cleanup():
    session = SessionLocal()
    try:
        # fetch all results ordered oldest->newest so we keep the earliest or latest as you prefer
        rows = session.query(Result).order_by(Result.created_at.asc(), Result.id.asc()).all()
        seen = set()
        to_delete_ids = []

        for r in rows:
            uname = make_user_key(r.user)
            created_iso = r.created_at.isoformat() if r.created_at else ""
            key = f"{r.quiz_id}|{uname}|{r.score}|{r.total}|{created_iso}"
            if key in seen:
                to_delete_ids.append(r.id)
            else:
                seen.add(key)

        if not to_delete_ids:
            print("No duplicate results found.")
            return

        print(f"Found {len(to_delete_ids)} duplicate result(s). Deleting...")
        for rid in to_delete_ids:
            row = session.query(Result).filter(Result.id == rid).first()
            if row:
                session.delete(row)
        session.commit()
        print("Duplicates removed:", to_delete_ids)
    finally:
        session.close()

if __name__ == "__main__":
    cleanup()