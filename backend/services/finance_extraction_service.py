"""
Structured financial-field extraction from raw document text via Gemini.
"""

import logging
import re
from typing import Literal

from services import gemini_service

logger = logging.getLogger(__name__)

DocumentType = Literal[
    "itr",
    "bank_statement",
    "salary_slip",
    "loan_agreement",
    "insurance_policy",
    "investment_statement",
    "credit_report",
]

FIELD_HINTS: dict[DocumentType, list[str]] = {
    "itr": [
        "assessment_year", "financial_year", "gross_total_income", "total_income",
        "taxable_income", "tax_paid", "tds", "employer_type", "salary_income",
        "business_income", "other_sources_income",
    ],
    "bank_statement": [
        "total_credits", "total_debits", "average_monthly_balance", "recurring_expenses",
        "salary_credits", "emi_payments", "suspicious_transactions", "large_transactions",
    ],
    "loan_agreement": [
        "loan_amount", "interest_rate", "tenure", "emi", "processing_fee", "gst_charges",
        "foreclosure_charges", "late_payment_penalty", "prepayment_conditions",
    ],
    "salary_slip": ["gross_salary", "net_salary", "deductions", "employer_name"],
    "insurance_policy": ["premium", "sum_assured", "policy_term", "exclusions"],
    "investment_statement": ["total_invested", "current_value", "instrument_types"],
    "credit_report": ["credit_score", "active_loans", "credit_utilization"],
}

def _build_prompt(document_type: DocumentType, extracted_text: str = "", has_file: bool = False) -> str:
    fields = FIELD_HINTS.get(document_type, ["key_facts"])
    source_desc = "visual document (image or document file)" if has_file else "document text below"
    context_part = f"\nDocument text:\n{extracted_text[:6000]}\n" if extracted_text else ""
    return f"""You are an expert financial document intelligence assistant. Carefully analyze the {source_desc} with high precision.

Document type: {document_type}
{context_part}
Perform the following tasks:
1. Extract exact, accurate financial figures from the document (never confuse symbols like ₹ with %, preserve Indian rupee symbols, percentages, monthly/annual frequencies, tenure, EMI, and interest rates).
2. Transcribe clean, readable text from the document.
3. Identify any important clauses, fees, penalties, prepayment conditions, or risks.

Respond with ONLY a valid JSON object (no markdown fences, no extra text) matching this schema:
{{
  "summary": "One or two concise, plain-language sentences summarizing the document type, provider/platform, and key figures",
  "extracted_text": "Clean, complete text transcribed from the document",
  "fields": {{ {", ".join(f'"{f}": "exact string value or null"' for f in fields)} }},
  "risks": ["list of important clauses, charges, penalties, or caveats - empty list if none found"]
}}

If a field is not present in the document, set its value to null. Do NOT invent numbers."""


def _match_value(text: str, labels: list[str], value_pattern: str) -> str | None:
    label_pattern = "|".join(re.escape(label) for label in labels)
    patterns = (
        rf"(?:{label_pattern})\s*(?:amount|is|of|:|-)?\s*({value_pattern})",
        rf"({value_pattern})\s*(?:as|for)?\s*(?:the\s+)?(?:{label_pattern})",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip()
    return None


def _fallback_fields(document_type: DocumentType, text: str) -> dict:
    money = r"(?:₹|rs\.?|inr)?\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:per\s+month|monthly|p\.?m\.?|per\s+year|annual(?:ly)?|p\.?a\.?))?"
    percent = r"\d+(?:\.\d+)?\s*%"
    duration = r"\d+\s*(?:months?|years?)"
    if document_type == "loan_agreement":
        return {
            "loan_amount": _match_value(text, ["loan amount", "principal amount", "sanctioned amount"], money),
            "interest_rate": _match_value(text, ["interest rate", "rate of interest"], percent),
            "tenure": _match_value(text, ["loan tenure", "tenure", "term"], duration),
            "emi": _match_value(text, ["monthly emi", "emi", "equated monthly instalment", "monthly installment"], money),
            "processing_fee": _match_value(text, ["processing fee", "processing charges"], money),
        }
    if document_type == "insurance_policy":
        return {
            "premium": _match_value(text, ["annual premium", "monthly premium", "premium"], money),
            "sum_assured": _match_value(text, ["sum assured", "sum insured", "coverage amount"], money),
            "policy_term": _match_value(text, ["policy term", "coverage term"], duration),
        }
    return {}


def _fallback_result(extracted_text: str, document_type: DocumentType) -> dict:
    return {
        "summary": (extracted_text[:300] + ("..." if len(extracted_text) > 300 else "")) if extracted_text else "Document uploaded.",
        "extracted_text": extracted_text,
        "fields": {key: value for key, value in _fallback_fields(document_type, extracted_text).items() if value},
        "risks": [],
    }


async def extract_financial_data(
    document_type: DocumentType,
    extracted_text: str = "",
    *,
    file_bytes: bytes | None = None,
    mime_type: str | None = None,
    model: str | None = None,
) -> dict:
    """
    Returns {"summary": str, "fields": dict, "risks": list[str], "extracted_text": str}.
    Uses Gemini Multimodal Vision when file_bytes is provided.
    Falls back to deterministic extraction if Gemini is unreachable.
    """
    has_file = bool(file_bytes and mime_type)
    prompt = _build_prompt(document_type, extracted_text, has_file=has_file)
    selected_model = gemini_service.resolve_model(model)

    try:
        parsed = await gemini_service.generate_json(
            prompt,
            model=selected_model,
            file_bytes=file_bytes,
            mime_type=mime_type,
        )
        return {
            "summary": parsed.get("summary") or _fallback_result(extracted_text, document_type)["summary"],
            "extracted_text": parsed.get("extracted_text") or extracted_text,
            "fields": parsed.get("fields") or {},
            "risks": parsed.get("risks") or [],
        }
    except (gemini_service.GeminiUnavailableError, ValueError, TypeError) as exc:
        logger.warning("Gemini extraction unavailable; using deterministic fallback: %s", exc)
        return _fallback_result(extracted_text, document_type)


def _build_hindi_explanation_prompt(
    document_type: str,
    summary: str,
    fields: dict,
    risks: list[str],
    extracted_text: str = "",
) -> str:
    fields_formatted = "\n".join(f"- {k.replace('_', ' ').title()}: {v}" for k, v in fields.items() if v)
    risks_formatted = "\n".join(f"- {r}" for r in risks) if risks else "None"
    text_snippet = extracted_text[:3000] if extracted_text else "No additional raw text."

    return f"""You are an expert Indian financial adviser and document intelligence assistant.
Your job is to explain this financial document to an everyday Indian citizen in clear, easy-to-understand Hindi (Devanagari script).

Document Type: {document_type}
Document Summary: {summary}
Extracted Fields:
{fields_formatted}

Flagged Clauses/Risks:
{risks_formatted}

Document Excerpt:
{text_snippet}

Requirements:
1. "hindi_title": A brief, accurate title in Hindi (e.g. "पर्सनल लोन एग्रीमेंट का विश्लेषण" or "इनकम टैक्स रिटर्न का विवरण").
2. "hindi_summary": 2-3 sentences in simple, conversational Hindi giving an overall explanation of what this document is, who issued it, and the key takeaway.
3. "key_points": A list of 4 to 6 concise bullet points in Devanagari Hindi outlining the most vital numbers and facts (e.g. कुल ऋण राशि, ब्याज दर, मासिक किश्त EMI, कुल अवधि, आदि).
4. "risks": A list of important cautions, penalties, hidden charges, or rules in Devanagari Hindi (e.g. देरी से भुगतान पर पेनल्टी, फोरक्लोज़र शुल्क, आदि). If there are no specific risks, provide 1 or 2 general safety guidelines in Hindi.
5. "spoken_text": A natural, conversational Hindi voice script specifically tailored for Text-to-Speech (TTS) readout.
   - Use natural spoken Devanagari Hindi without confusing jargon.
   - When reading figures, use words like "5 लाख रुपये", "16 हजार 217 रुपये", "10.5 प्रतिशत प्रति वर्ष".
   - Keep it engaging, clear, concise (around 3-5 sentences), and polite.
   - Do NOT use markdown symbols, asterisks, bullet dashes, or brackets in "spoken_text".

Respond with ONLY a valid JSON object matching this schema:
{{
  "hindi_title": "...",
  "hindi_summary": "...",
  "key_points": ["...", "..."],
  "risks": ["...", "..."],
  "spoken_text": "..."
}}
"""


def _fallback_hindi_explanation(
    document_type: str,
    summary: str,
    fields: dict,
    risks: list[str],
) -> dict:
    doc_type_names = {
        "loan_agreement": "ऋण (लोन) समझौता",
        "insurance_policy": "बीमा पॉलिसी",
        "bank_statement": "बैंक खाता विवरण",
        "salary_slip": "वेतन पर्ची (Salary Slip)",
        "itr": "आयकर रिटर्न (ITR)",
        "investment_statement": "निवेश विवरण",
        "credit_report": "क्रेडिट रिपोर्ट",
    }
    name = doc_type_names.get(document_type, "वित्तीय दस्तावेज़")
    points = []
    for k, v in (fields or {}).items():
        if v:
            clean_k = k.replace('_', ' ')
            points.append(f"{clean_k}: {v}")
    if not points:
        points = ["दस्तावेज़ की जानकारी सफलतापूर्वक अपलोड की गई है।"]

    hindi_summary = f"यह आपका {name} है। {summary if summary else 'दस्तावेज़ की मुख्य जानकारी प्राप्त कर ली गई है।'}"
    spoken_text = f"यह आपका {name} है। {summary if summary else ''} कृपया मुख्य विवरण और वित्तीय शर्तों की जांच कर लें।"

    return {
        "hindi_title": f"{name} का विवरण",
        "hindi_summary": hindi_summary,
        "key_points": points,
        "risks": risks if risks else ["कृपया सभी नियमों और शर्तों को ध्यानपूर्वक पढ़ें।"],
        "spoken_text": spoken_text.replace("*", "").replace("#", ""),
    }


async def explain_document_in_hindi(
    document_type: str,
    summary: str = "",
    fields: dict | None = None,
    risks: list[str] | None = None,
    extracted_text: str = "",
    *,
    model: str | None = None,
) -> dict:
    """
    Generates a structured, easy-to-read Hindi explanation and spoken audio script
    for any financial document.
    """
    prompt = _build_hindi_explanation_prompt(
        document_type=document_type,
        summary=summary,
        fields=fields or {},
        risks=risks or [],
        extracted_text=extracted_text,
    )
    selected_model = gemini_service.resolve_model(model)
    try:
        parsed = await gemini_service.generate_json(prompt, model=selected_model)
        return {
            "hindi_title": parsed.get("hindi_title") or f"{document_type} का विवरण",
            "hindi_summary": parsed.get("hindi_summary") or summary,
            "key_points": parsed.get("key_points") or [],
            "risks": parsed.get("risks") or [],
            "spoken_text": parsed.get("spoken_text") or parsed.get("hindi_summary") or summary,
        }
    except (gemini_service.GeminiUnavailableError, ValueError, TypeError) as exc:
        logger.warning("Gemini Hindi explanation unavailable; using deterministic fallback: %s", exc)
        return _fallback_hindi_explanation(document_type, summary, fields or {}, risks or [])

