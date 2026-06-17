from sqlalchemy.orm import Session
from sqlalchemy import text, func
from typing import Type, TypeVar, Generic, List, Optional
from app.database.models import Base, Product, Transaction

ModelType = TypeVar("ModelType", bound=Base)

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get_by_id(self, db: Session, id: int) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, db: Session) -> List[ModelType]:
        return db.query(self.model).all()

    def create(self, db: Session, obj_in: dict) -> ModelType:
        obj = self.model(**obj_in)
        db.add(obj)
        db.flush()
        return obj

class ProductRepository(BaseRepository[Product]):
    def __init__(self):
        super().__init__(Product)

    def get_by_name(self, db: Session, name: str) -> Optional[Product]:
        return db.query(self.model).filter(self.model.name == name).first()
        
    def get_all_names(self, db: Session) -> List[str]:
        results = db.query(self.model.name).all()
        return [r[0] for r in results]

class TransactionRepository(BaseRepository[Transaction]):
    def __init__(self):
        super().__init__(Transaction)

    def get_dynamic_inventory_stock(self, db: Session) -> List[dict]:
        """
        Executes the pure SQL calculation for dynamic inventory mathematically 
        deriving stock directly from transactions.
        """
        sql_query = text("""
            SELECT 
                p.name,
                COALESCE(SUM(
                    CASE 
                        WHEN t.transaction_type = 'purchase' 
                        THEN t.quantity 
                        ELSE -t.quantity 
                    END
                ), 0) as stock
            FROM products p
            LEFT JOIN transactions t ON p.id = t.product_id
            GROUP BY p.name;
        """)
        result = db.execute(sql_query).all()
        return [{"product": row[0], "stock": float(row[1])} for row in result]

product_repo = ProductRepository()
transaction_repo = TransactionRepository()
