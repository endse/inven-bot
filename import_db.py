import os
import pandas as pd
from datetime import date
from app.database.database import Base, engine, SessionLocal
from app.database.models import Product, Transaction
from app.utils.logger import logger

def init_db():
    logger.info("Dropping and re-creating tables in database...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    logger.info("Tables created successfully.")

def import_historical_data(excel_path: str = "GST 2026.xlsx"):
    db = SessionLocal()
    try:
        if not os.path.exists(excel_path):
            logger.error(f"Excel file not found at {excel_path}")
            return

        xl = pd.ExcelFile(excel_path)
        logger.info(f"Found sheets: {xl.sheet_names}")

        first_sheet = xl.sheet_names[0]
        df_first = xl.parse(first_sheet)
        
        first_col_mapping = {}
        for col in df_first.columns:
            col_lower = str(col).strip().lower()
            if col_lower == 'name':
                first_col_mapping[col] = 'Name'
            elif 'hsn' in col_lower or 'h.s.n' in col_lower:
                first_col_mapping[col] = 'HSN'
            elif col_lower == 'rate':
                first_col_mapping[col] = 'Rate'
        df_first = df_first.rename(columns=first_col_mapping)

        product_map = {}
        
        logger.info("Importing products...")
        for _, row in df_first.iterrows():
            name = str(row.get('Name', '')).strip()
            if not name or name.lower() == 'nan' or 'total' in name.lower() or name.startswith('Unnamed'):
                continue
            
            hsn_val = row.get('HSN', None)
            hsn = str(hsn_val).strip() if pd.notna(hsn_val) else None
            if hsn and hsn.endswith('.0'):
                hsn = hsn[:-2]
                
            rate_val = row.get('Rate', None)
            if isinstance(rate_val, str):
                rate_val = rate_val.replace('₹', '').replace(',', '').strip()
            rate = float(rate_val) if pd.notna(rate_val) and rate_val != "" else None

            existing_prod = db.query(Product).filter(Product.name == name).first()
            if not existing_prod:
                prod = Product(name=name, hsn=hsn, last_rate=rate)
                db.add(prod)
                db.flush()
                product_map[name] = prod.id
            else:
                product_map[name] = existing_prod.id

        db.commit()
        logger.info(f"Products imported. Total: {len(product_map)}")

        for sheet in xl.sheet_names:
            logger.info(f"Processing sheet: {sheet}...")
            df = xl.parse(sheet)
            
            try:
                sheet_dt = pd.to_datetime(sheet, format="%b-%y")
                year = sheet_dt.year
                month = sheet_dt.month
            except Exception:
                continue

            col_mapping = {}
            for col in df.columns:
                col_lower = str(col).strip().lower()
                if col_lower == 'name':
                    col_mapping[col] = 'Name'
                elif col_lower == 'opening balance':
                    col_mapping[col] = 'OpeningBalance'
                elif 'purchase' in col_lower:
                    col_mapping[col] = 'Purchase'
                elif col_lower == 'sales':
                    col_mapping[col] = 'Sales'
                elif col_lower == 'rate':
                    col_mapping[col] = 'Rate'

            df = df.rename(columns=col_mapping)

            for _, row in df.iterrows():
                name = str(row.get('Name', '')).strip()
                if name not in product_map:
                    continue
                
                prod_id = product_map[name]
                rate_val = row.get('Rate', None)
                if isinstance(rate_val, str):
                    rate_val = rate_val.replace('₹', '').replace(',', '').strip()
                rate = float(rate_val) if pd.notna(rate_val) and rate_val != "" else 0.0

                if sheet == xl.sheet_names[0]:
                    op_val = row.get('OpeningBalance', 0.0)
                    op_qty = float(op_val) if pd.notna(op_val) else 0.0
                    if op_qty > 0:
                        db.add(Transaction(
                            product_id=prod_id,
                            transaction_type='purchase',
                            transaction_date=date(2025, 12, 31),
                            quantity=op_qty,
                            rate=rate,
                            amount=op_qty * rate,
                            date_source='initial_balance'
                        ))

                pur_val = row.get('Purchase', 0.0)
                pur_qty = float(pur_val) if pd.notna(pur_val) else 0.0
                if pur_qty > 0:
                    db.add(Transaction(
                        product_id=prod_id,
                        transaction_type='purchase',
                        transaction_date=date(year, month, 15),
                        quantity=pur_qty,
                        rate=rate,
                        amount=pur_qty * rate,
                        date_source='imported_excel'
                    ))

                sal_val = row.get('Sales', 0.0)
                sal_qty = float(sal_val) if pd.notna(sal_val) else 0.0
                if sal_qty > 0:
                    db.add(Transaction(
                        product_id=prod_id,
                        transaction_type='sale',
                        transaction_date=date(year, month, 15),
                        quantity=sal_qty,
                        rate=rate,
                        amount=sal_qty * rate,
                        date_source='imported_excel'
                    ))
            
            db.commit()

        logger.info("Import completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    import_historical_data()
