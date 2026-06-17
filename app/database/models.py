from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, func, CheckConstraint
from sqlalchemy.orm import relationship
from app.database.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    hsn = Column(String, nullable=True)
    last_rate = Column(Numeric(12, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    transactions = relationship("Transaction", back_populates="product", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    transaction_type = Column(String(20), nullable=False, index=True)
    transaction_date = Column(Date, nullable=False, index=True)
    
    date_source = Column(String(20), nullable=False)
    
    quantity = Column(Numeric(12, 2), nullable=False)
    rate = Column(Numeric(12, 2), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    
    invoice_image_url = Column(String, nullable=True)
    invoice_filename = Column(String, nullable=True)
    image_hash = Column(String, nullable=True, index=True)
    raw_ai_response = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    product = relationship("Product", back_populates="transactions")
    
    __table_args__ = (
        CheckConstraint(transaction_type.in_(['purchase', 'sale']), name='valid_transaction_type'),
        CheckConstraint(date_source.in_(['invoice', 'system', 'initial_balance', 'imported_excel']), name='valid_date_source'),
    )

class ProductMatchReview(Base):
    __tablename__ = "product_match_reviews"

    id = Column(Integer, primary_key=True, index=True)
    invoice_product_name = Column(String, nullable=False)
    suggested_product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    similarity_score = Column(Numeric(5, 2), nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    
    pending_transaction_data = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    suggested_product = relationship("Product")
    
    __table_args__ = (
        CheckConstraint(status.in_(['pending', 'approved', 'rejected']), name='valid_review_status'),
    )
