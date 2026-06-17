import os
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional

class InvoiceItem(BaseModel):
    product_name: str
    quantity: float
    rate: float
    amount: float

class InvoiceExtraction(BaseModel):
    invoice_date: Optional[str] = Field(None, description="Invoice date in YYYY-MM-DD format")
    items: List[InvoiceItem]

def extract_invoice_items(image_bytes: bytes, mime_type: str) -> InvoiceExtraction:
    """
    Calls Gemini model using the google-genai SDK to extract items from an invoice image.
    Uses structured outputs to guarantee JSON matching InvoiceExtraction schema.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in the environment variables")
        
    client = genai.Client(api_key=api_key)
    
    prompt = """
    Extract ONLY inventory items from the invoice image.
    Ignore:
    - GST
    - Address
    - Vendor details
    - Phone numbers
    - Invoice totals

    For every item, extract:
    - product_name
    - quantity
    - rate
    - amount

    Also extract the invoice date and format it as YYYY-MM-DD.
    """
    
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type,
            ),
            prompt
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=InvoiceExtraction,
            temperature=0.1,
        ),
    )
    
    # Parse the response text using Pydantic validation
    return InvoiceExtraction.model_validate_json(response.text)
