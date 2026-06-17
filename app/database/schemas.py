from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List

class ProductBase(BaseModel):
    name: str
    hsn: Optional[str] = None
    last_rate: Optional[Decimal] = None

class ProductCreate(ProductBase):
    pass

class ProductSchema(ProductBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    product_id: int
    transaction_type: str = Field(..., description="Must be 'purchase' or 'sale'")
    transaction_date: date
    quantity: Decimal
    rate: Decimal
    amount: Decimal
    date_source: str
    invoice_image_url: Optional[str] = None
    invoice_filename: Optional[str] = None
    image_hash: Optional[str] = None
    raw_ai_response: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionSchema(TransactionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class StockResponseItem(BaseModel):
    product: str
    stock: float
