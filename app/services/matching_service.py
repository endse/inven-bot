from rapidfuzz import process
from app.utils.logger import logger

def match_product_name(invoice_product: str, db_products: list[str]) -> tuple[str, float]:
    """
    Fuzzy matches the invoice product against existing database products.
    Returns: (matched_name, score)
    """
    if not db_products or not invoice_product:
        return None, 0.0
        
    match = process.extractOne(invoice_product.strip(), db_products)
    if match:
        score = match[1]
        matched_name = match[0]
        logger.info(f"Fuzzy match '{invoice_product}' -> '{matched_name}' with score {score:.2f}")
        return matched_name, score
        
    return None, 0.0
