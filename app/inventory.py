import os
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models import Product, Transaction
from rapidfuzz import process, score_mod

def import_products_from_excel(db: Session, excel_path: str):
    """
    Reads all products from the Excel workbook and populates the products table.
    Expects columns: Name, H.S.N no (or HSN), Rate.
    """
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found at {excel_path}")
    
    xl = pd.ExcelFile(excel_path)
    # Read the first sheet (e.g. 'Jan-26', 'Feb-26', etc.)
    df = xl.parse(xl.sheet_names[0])
    
    # Standardize column names
    col_mapping = {}
    for col in df.columns:
        col_lower = str(col).strip().lower()
        if col_lower == 'name':
            col_mapping[col] = 'Name'
        elif 'hsn' in col_lower or 'h.s.n' in col_lower:
            col_mapping[col] = 'HSN'
        elif col_lower == 'rate':
            col_mapping[col] = 'Rate'
            
    df = df.rename(columns=col_mapping)
    
    imported_count = 0
    for _, row in df.iterrows():
        name = str(row.get('Name', '')).strip()
        if not name or name.lower() == 'nan' or 'total' in name.lower() or name.startswith('Unnamed'):
            continue
            
        hsn_val = row.get('HSN', None)
        hsn = str(hsn_val).strip() if pd.notna(hsn_val) else None
        if hsn and hsn.endswith('.0'):
            hsn = hsn[:-2]  # Remove trailing float representation of HSN
            
        rate_val = row.get('Rate', None)
        rate = float(rate_val) if pd.notna(rate_val) else None
        
        # Check if product already exists
        existing_product = db.query(Product).filter(Product.name == name).first()
        if not existing_product:
            product = Product(name=name, hsn=hsn, last_rate=rate)
            db.add(product)
            imported_count += 1
        else:
            # Update hsn and rate if present
            if hsn:
                existing_product.hsn = hsn
            if rate is not None:
                existing_product.last_rate = rate
                
    db.commit()
    return imported_count

def get_all_product_names(db: Session) -> list:
    """Returns a list of all product names in the database."""
    products = db.query(Product.name).all()
    return [p[0] for p in products]

def match_product(invoice_product: str, db_products: list) -> tuple:
    """
    Fuzzy match invoice product name against database product names.
    Returns: (matched_name, score)
    """
    if not db_products or not invoice_product:
        return None, 0.0
    
    # extractOne returns (match_str, score, index) or similar
    match = process.extractOne(invoice_product.strip(), db_products)
    if match:
        return match[0], match[1]
    return None, 0.0

def calculate_stock(db: Session):
    """
    Returns the current stock levels directly from the products table.
    """
    sql_query = text("SELECT name, current_stock as stock FROM products;")
    result = db.execute(sql_query).all()
    return [{"product": row[0], "stock": float(row[1])} for row in result]
