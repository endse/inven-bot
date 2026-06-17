from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
from decimal import Decimal
from app.database.repositories import product_repo, transaction_repo
from app.database.models import Transaction

def record_transaction(
    db: Session,
    product_id: int,
    transaction_type: str,
    quantity: Decimal,
    rate: Decimal,
    amount: Decimal,
    transaction_date: date,
    date_source: str,
    invoice_image_url: Optional[str] = None,
    invoice_filename: Optional[str] = None,
    image_hash: Optional[str] = None,
    raw_ai_response: Optional[str] = None
) -> Transaction:
    """
    Records an immutable transaction.
    """
    if transaction_type not in ['purchase', 'sale']:
        raise ValueError("Invalid transaction_type")
        
    tx_data = {
        "product_id": product_id,
        "transaction_type": transaction_type,
        "transaction_date": transaction_date,
        "quantity": quantity,
        "rate": rate,
        "amount": amount,
        "date_source": date_source,
        "invoice_image_url": invoice_image_url,
        "invoice_filename": invoice_filename,
        "image_hash": image_hash,
        "raw_ai_response": raw_ai_response
    }
    
    # Delegate to repository
    return transaction_repo.create(db, tx_data)
