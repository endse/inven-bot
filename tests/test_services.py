import pytest
from app.services.transaction_service import record_transaction
from app.services.inventory_service import get_inventory_stock
from app.database.repositories import product_repo
from datetime import date

def test_record_transaction_invalid_type(db_session):
    prod = product_repo.create(db_session, {"name": "Tx Product"})
    db_session.commit()

    with pytest.raises(ValueError, match="Invalid transaction_type"):
        record_transaction(
            db=db_session,
            product_id=prod.id,
            transaction_type="invalid_type",
            quantity=5,
            rate=10,
            amount=50,
            transaction_date=date.today(),
            date_source="system"
        )

def test_inventory_service_delegation(db_session):
    prod = product_repo.create(db_session, {"name": "Service Product"})
    db_session.commit()
    
    record_transaction(
        db=db_session,
        product_id=prod.id,
        transaction_type="purchase",
        quantity=20,
        rate=5,
        amount=100,
        transaction_date=date.today(),
        date_source="system"
    )
    db_session.commit()
    
    stocks = get_inventory_stock(db_session)
    assert stocks[0]["product"] == "Service Product"
    assert stocks[0]["stock"] == 20.0
