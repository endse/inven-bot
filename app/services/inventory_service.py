from sqlalchemy.orm import Session
from app.database.repositories import transaction_repo

def get_inventory_stock(db: Session):
    """
    Calculates stock dynamically across all products based on transaction history.
    Delegates to the TransactionRepository.
    """
    return transaction_repo.get_dynamic_inventory_stock(db)
