import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import re
from tenacity import retry, stop_after_attempt, wait_exponential
from app.utils.config import settings
from app.utils.logger import logger

class InvoiceItem(BaseModel):
    product_name: str
    quantity: float
    rate: float
    amount: float

class InvoiceExtraction(BaseModel):
    invoice_date: Optional[str] = Field(None, description="Invoice date in YYYY-MM-DD format if available")
    items: List[InvoiceItem]

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def extract_invoice_data(image_bytes: bytes, mime_type: str = "image/jpeg") -> InvoiceExtraction:
    """
    Calls Gemini model using the google-genai SDK to extract items from an invoice image.
    Uses structured outputs to guarantee JSON matching.
    """
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    prompt = """
    Extract ONLY inventory items.
    
    Ignore:
    GST
    Tax summary
    Address
    Phone numbers
    Vendor details
    Customer details
    Invoice totals
    Bank information
    
    Extract:
    invoice_date
    items:
    product_name
    quantity
    rate
    amount
    
    Return valid JSON only.
    Do not return markdown.
    Do not return explanations.
    """
    
    logger.info("Sending invoice to Gemini 2.5 Flash Vision...")
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=InvoiceExtraction,
            temperature=0.1,
        ),
    )
    
    logger.info("Received extraction from Gemini.")
    raw_text = response.text
    
    # Fallback: Strip markdown if Gemini ignores instructions
    if raw_text.strip().startswith("```"):
        logger.warning("Gemini returned markdown instead of raw JSON. Applying fallback stripping.")
        raw_text = re.sub(r"^```json\s*", "", raw_text)
        raw_text = re.sub(r"^```\s*", "", raw_text)
        raw_text = re.sub(r"\s*```$", "", raw_text)
        
    try:
        parsed_data = InvoiceExtraction.model_validate_json(raw_text)
        return parsed_data, raw_text
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
        logger.error(f"Raw Output: {raw_text}")
        raise
