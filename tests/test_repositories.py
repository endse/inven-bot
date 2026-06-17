from app.database.repositories import product_repo, transaction_repo
from datetime import date

def test_product_repository_create_and_get(db_session):
    prod = product_repo.create(db_session, {"name": "Repo Product", "last_rate": 50.0})
    db_session.commit()
    
    fetched = product_repo.get_by_id(db_session, prod.id)
    assert fetched.name == "Repo Product"
    
    by_name = product_repo.get_by_name(db_session, "Repo Product")
    assert by_name.id == prod.id

def test_transaction_repository_dynamic_stock(db_session):
    prod = product_repo.create(db_session, {"name": "Dynamic Product"})
    db_session.commit()
    
    # 1. Purchase 10
    transaction_repo.create(db_session, {
        "product_id": prod.id,
        "transaction_type": "purchase",
        "quantity": 10.0,
        "rate": 100.0,
        "amount": 1000.0,
        "transaction_date": date.today(),
        "date_source": "system"
    })
    
    # 2. Sale 3
    transaction_repo.create(db_session, {
        "product_id": prod.id,
        "transaction_type": "sale",
        "quantity": 3.0,
        "rate": 120.0,
        "amount": 360.0,
        "transaction_date": date.today(),
        "date_source": "system"
    })
    
    db_session.commit()
    
    stocks = transaction_repo.get_dynamic_inventory_stock(db_session)
    assert len(stocks) == 1
    assert stocks[0]["product"] == "Dynamic Product"
    assert stocks[0]["stock"] == 7.0  # 10 - 3 = 7
