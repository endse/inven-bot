import hashlib
from sqlalchemy.orm import Session
from app.database.models import Transaction

def compute_image_hash(image_bytes: bytes) -> str:
    """Computes SHA256 hash of image bytes for duplicate detection."""
    return hashlib.sha256(image_bytes).hexdigest()

def is_duplicate_invoice(db: Session, image_hash: str) -> bool:
    """Checks if an image hash already exists in the transactions table."""
    if not image_hash:
        return False
    
    existing = db.query(Transaction).filter(Transaction.image_hash == image_hash).first()
    return existing is not None
