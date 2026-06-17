from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.database import get_db
from app.database.models import Product
from app.database.schemas import ProductSchema, ProductCreate, TransactionSchema, TransactionCreate, StockResponseItem
from app.services.inventory_service import get_inventory_stock
from app.services.transaction_service import record_transaction
from app.database.repositories import product_repo
from app.reports.excel_generator import generate_monthly_report
import os

router = APIRouter()

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.post("/transactions/purchase", response_model=TransactionSchema)
def create_purchase(tx_data: TransactionCreate, db: Session = Depends(get_db)):
    tx = record_transaction(
        db=db,
        product_id=tx_data.product_id,
        transaction_type='purchase',
        quantity=tx_data.quantity,
        rate=tx_data.rate,
        amount=tx_data.amount,
        transaction_date=tx_data.transaction_date,
        date_source=tx_data.date_source,
        invoice_image_url=tx_data.invoice_image_url,
        invoice_filename=tx_data.invoice_filename,
        raw_ai_response=tx_data.raw_ai_response
    )
    db.commit()
    return tx

@router.post("/transactions/sale", response_model=TransactionSchema)
def create_sale(tx_data: TransactionCreate, db: Session = Depends(get_db)):
    tx = record_transaction(
        db=db,
        product_id=tx_data.product_id,
        transaction_type='sale',
        quantity=tx_data.quantity,
        rate=tx_data.rate,
        amount=tx_data.amount,
        transaction_date=tx_data.transaction_date,
        date_source=tx_data.date_source,
        invoice_image_url=tx_data.invoice_image_url,
        invoice_filename=tx_data.invoice_filename,
        raw_ai_response=tx_data.raw_ai_response
    )
    db.commit()
    return tx

@router.get("/inventory", response_model=List[StockResponseItem])
def get_inventory(db: Session = Depends(get_db)):
    return get_inventory_stock(db)

@router.get("/inventory/{product_id}", response_model=StockResponseItem)
def get_product_inventory(product_id: int, db: Session = Depends(get_db)):
    stocks = get_inventory_stock(db)
    prod = product_repo.get_by_id(db, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    for s in stocks:
        if s['product'] == prod.name:
            return s
    return {"product": prod.name, "stock": 0.0}

@router.get("/products", response_model=List[ProductSchema])
def get_products(db: Session = Depends(get_db)):
    return product_repo.get_all(db)

@router.post("/products", response_model=ProductSchema)
def create_product(prod_data: ProductCreate, db: Session = Depends(get_db)):
    existing = product_repo.get_by_name(db, prod_data.name)
    if existing:
        raise HTTPException(status_code=400, detail="Product already exists")
    prod = product_repo.create(db, prod_data.model_dump())
    db.commit()
    return prod

@router.get("/reports/monthly")
def get_monthly_report(year_month: str, db: Session = Depends(get_db)):
    # e.g. year_month = '2026-06'
    try:
        path = generate_monthly_report(db, year_month)
        return {"status": "success", "file": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/yearly")
def get_yearly_report(year: str, db: Session = Depends(get_db)):
    # Placeholder for yearly report implementation
    return {"status": "not_implemented"}
