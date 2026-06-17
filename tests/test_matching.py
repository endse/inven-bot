import pytest
from app.services.matching_service import match_product_name

def test_match_product_exact():
    db_products = ["4 inch pipe", "elbow joint", "110mm PVC"]
    matched, score = match_product_name("4 inch pipe", db_products)
    assert matched == "4 inch pipe"
    assert score == 100.0

def test_match_product_fuzzy():
    db_products = ["110mm elbow (6 KG)", "110mm tee (6 KG)"]
    matched, score = match_product_name("110 mm elbow", db_products)
    assert matched == "110mm elbow (6 KG)"
    assert score > 80.0

def test_match_product_no_match():
    db_products = ["4 inch pipe"]
    matched, score = match_product_name("super glue", db_products)
    assert score < 50.0  # Should be very low
