from app.database.models import Product, Transaction
from sqlalchemy.exc import IntegrityError
import pytest
from datetime import date

def test_create_product(db_session):
    prod = Product(name="Test Product", hsn="1234", last_rate=10.50)
    db_session.add(prod)
    db_session.commit()
    
    saved = db_session.query(Product).first()
    assert saved.name == "Test Product"
    assert saved.last_rate == 10.50

def test_product_unique_name_constraint(db_session):
    prod1 = Product(name="Duplicate")
    prod2 = Product(name="Duplicate")
    
    db_session.add(prod1)
    db_session.commit()
    
    db_session.add(prod2)
    with pytest.raises(IntegrityError):
        db_session.commit()
