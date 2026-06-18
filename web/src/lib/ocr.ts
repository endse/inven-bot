import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PROMPT = `You are an invoice parsing engine.
Extract inventory line items only.

Ignore:
GST
Tax totals
Addresses
Phone numbers
Bank details
Invoice summaries

Return JSON:
{
  "invoice_date":"",
  "items":[
    {
      "product_name":"",
      "quantity":0,
      "rate":0,
      "amount":0,
      "hsn":"",
      "discount":0,
      "tax_rate":0,
      "confidence_score":0.99
    }
  ]
}

If uncertain, preserve original product name exactly.
Do not invent values.
Return valid JSON only.`;

export interface ExtractedItem {
  product_name: string;
  quantity: number;
  rate: number;
  amount: number;
  hsn?: string;
  discount?: number;
  tax_rate?: number;
  confidence_score?: number;
}

export interface ExtractedInvoice {
  invoice_date: string;
  items: ExtractedItem[];
}

export async function extractInvoiceItems(
  base64Image: string, 
  mimeType: string, 
  existingProducts: string[] = []
): Promise<ExtractedInvoice> {
  let finalPrompt = PROMPT;
  if (existingProducts.length > 0) {
    finalPrompt += `\n\nCRITICAL INSTRUCTION FOR PRODUCT MAPPING:
We have a list of existing product names in our inventory database. For each extracted invoice line item, look at its name/description and check if it is a semantic or close match to any of the product names in the provided list.
- If it matches one of our existing product names (even with minor spelling differences, different case, abbreviations, extra description words, or different party/brand naming styles), return the EXACT name from our existing products list in the "product_name" field.
- If it is a completely new product that is not present in our list, return the original product name as it appears on the invoice in the "product_name" field.

List of existing products in our database:
${existingProducts.map(p => `- ${p}`).join('\n')}`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: finalPrompt },
          { inlineData: { data: base64Image, mimeType } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
    }
  });

  if (!response.text) {
    throw new Error("Failed to extract data from image");
  }

  try {
    return JSON.parse(response.text) as ExtractedInvoice;
  } catch (e) {
    throw new Error("Invalid JSON response from AI");
  }
}
