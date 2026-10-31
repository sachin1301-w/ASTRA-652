"""
PII and Privacy Masking Service for FinLens AI.
Provides deterministic regex masking for Indian identifiers (Aadhaar, PAN, IFSC,
mobile, bank accounts, emails, UPI) and optional local Named Entity Recognition (NER)
via DistilBERT to strip personal names before text is forwarded to external LLMs/APIs.
"""

import re
from typing import Dict, List, Optional, Tuple

from config import settings
from services.ml.registry import registry

# Compiled Regex Patterns
RE_AADHAAR = re.compile(r"\b([2-9]\d{3}[ -]?\d{4}[ -]?\d{4})\b")
RE_PAN = re.compile(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b")
RE_IFSC = re.compile(r"\b([A-Z]{4}0[A-Z0-9]{6})\b")
# Indian mobile numbers: optional +91, starts with 6-9, followed by 9 digits
RE_PHONE = re.compile(r"(?:(?:\+91|0)[\s-]?)?([6-9]\d{9})\b")
# Email addresses
RE_EMAIL = re.compile(r"\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
# UPI IDs (e.g. name@okhdfcbank, mobile@paytm, user@upi)
RE_UPI = re.compile(r"\b([a-zA-Z0-9.\-_]{2,64}@(?!gmail|yahoo|outlook|hotmail|icloud|proton)[a-zA-Z0-9.\-_]{2,32})\b", re.IGNORECASE)
# Bank account / Card numbers (11 to 18 contiguous digits, excluding currency patterns or decimals)
RE_ACCOUNT = re.compile(r"(?<![₹$€£\d])\b(\d{11,18})\b(?!\.\d|%)")

# Card formatted in 4 groups of 4 digits: 1234-5678-9012-3456 or 1234 5678 9012 3456
RE_CARD = re.compile(r"\b(\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4})\b")

# Currency guard to prevent masking rupee amounts like ₹5,00,000 or 500000 INR
RE_CURRENCY_EXCLUDE = re.compile(r"(?:₹|Rs\.?|INR)\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?\s*(?:₹|Rs\.?|INR|Lakh|Crore|Cr|percent|%|\/month|\/yr)", re.IGNORECASE)


def _has_devanagari(text: str) -> bool:
    """Check if the text segment contains Devanagari characters (Hindi, Marathi, etc.)."""
    return any("\u0900" <= ch <= "\u097f" for ch in text)


class PIIReport:
    def __init__(self):
        self.counts: Dict[str, int] = {
            "aadhaar": 0,
            "pan": 0,
            "ifsc": 0,
            "phone": 0,
            "email": 0,
            "upi": 0,
            "account": 0,
            "person": 0,
        }

    def increment(self, item_type: str) -> None:
        if item_type in self.counts:
            self.counts[item_type] += 1
        else:
            self.counts[item_type] = 1

    @property
    def total(self) -> int:
        return sum(self.counts.values())

    def to_dict(self) -> dict:
        return {
            **self.counts,
            "total": self.total,
        }


def mask_regex_identifiers(text: str, report: PIIReport) -> str:
    """
    Applies deterministic regex masking with stable placeholder tags.
    Preserves last 4 digits for verifiable reconciliation where useful.
    """
    tag_map: Dict[str, str] = {}
    counters: Dict[str, int] = {}

    def get_tag(tag_prefix: str, val: str, last4: Optional[str] = None) -> str:
        clean_key = f"{tag_prefix}:{val.strip().lower()}"
        if clean_key not in tag_map:
            counters[tag_prefix] = counters.get(tag_prefix, 0) + 1
            idx = counters[tag_prefix]
            suffix = f" (last 4: {last4})" if last4 else ""
            tag_map[clean_key] = f"[{tag_prefix}_{idx}{suffix}]"
            report.increment(tag_prefix.lower())
        return tag_map[clean_key]

    # 1. Aadhaar Masking
    def _aadhaar_sub(match: re.Match) -> str:
        raw = match.group(1)
        digits = re.sub(r"\D", "", raw)
        if len(digits) == 12:
            last4 = digits[-4:]
            return get_tag("AADHAAR", digits, last4=last4)
        return match.group(0)

    text = RE_AADHAAR.sub(_aadhaar_sub, text)

    # 2. Card Masking (16 digits separated by - or space)
    def _card_sub(match: re.Match) -> str:
        raw = match.group(1)
        digits = re.sub(r"\D", "", raw)
        last4 = digits[-4:]
        return get_tag("CARD", digits, last4=last4)

    text = RE_CARD.sub(_card_sub, text)

    # 3. Bank Account Masking (11-18 contiguous digits, before 10-digit phones)
    def _account_sub(match: re.Match) -> str:
        raw = match.group(1)
        last4 = raw[-4:]
        return get_tag("ACCOUNT", raw, last4=last4)

    text = RE_ACCOUNT.sub(_account_sub, text)

    # 4. PAN Masking
    def _pan_sub(match: re.Match) -> str:
        raw = match.group(1).upper()
        return get_tag("PAN", raw, last4=raw[-4:])

    text = RE_PAN.sub(_pan_sub, text)

    # 5. IFSC Masking
    def _ifsc_sub(match: re.Match) -> str:
        raw = match.group(1).upper()
        return get_tag("IFSC", raw)

    text = RE_IFSC.sub(_ifsc_sub, text)

    # 6. Email Masking
    def _email_sub(match: re.Match) -> str:
        raw = match.group(1)
        return get_tag("EMAIL", raw)

    text = RE_EMAIL.sub(_email_sub, text)

    # 7. UPI Masking
    def _upi_sub(match: re.Match) -> str:
        raw = match.group(1)
        return get_tag("UPI", raw)

    text = RE_UPI.sub(_upi_sub, text)

    # 8. Phone Masking
    def _phone_sub(match: re.Match) -> str:
        raw = match.group(1)
        last4 = raw[-4:]
        return get_tag("PHONE", raw, last4=last4)

    text = RE_PHONE.sub(_phone_sub, text)


    return text


def mask_ner_entities(text: str, report: PIIReport) -> str:
    """
    Applies DistilBERT-NER to mask person names with [PERSON_1], etc.
    English only; skips text segments containing Devanagari characters.
    """
    if _has_devanagari(text):
        return text

    ner_pipeline = registry.get("ner")
    if ner_pipeline is None:
        return text

    # Process in chunks of <= 400 words
    words = text.split()
    if not words:
        return text

    chunk_size = 350
    chunks = [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]

    processed_chunks: List[str] = []
    person_map: Dict[str, str] = {}
    person_idx = 1

    for chunk in chunks:
        if _has_devanagari(chunk):
            processed_chunks.append(chunk)
            continue

        try:
            entities = ner_pipeline(chunk)
        except Exception:
            processed_chunks.append(chunk)
            continue

        # Sort entities by start descending to replace without offset drift
        entities_to_replace = []
        for ent in entities:
            entity_label = ent.get("entity_group") or ent.get("entity", "")
            if "PER" in entity_label:
                entities_to_replace.append(ent)

        # Sort by start descending
        entities_to_replace.sort(key=lambda x: x["start"], reverse=True)

        current_chunk = chunk
        for ent in entities_to_replace:
            orig_word = ent["word"].strip()
            # Skip single characters or punctuation
            if len(orig_word) < 2:
                continue

            clean_key = orig_word.lower()
            if clean_key not in person_map:
                person_map[clean_key] = f"[PERSON_{person_idx}]"
                person_idx += 1
                report.increment("person")

            tag = person_map[clean_key]
            start = ent["start"]
            end = ent["end"]
            current_chunk = current_chunk[:start] + tag + current_chunk[end:]

        processed_chunks.append(current_chunk)

    return " ".join(processed_chunks)


def mask_pii(text: str) -> Tuple[str, dict]:
    """
    Main entry point for PII masking.
    Always runs regex masking. If ENABLE_NER is set and available, also masks person names.
    Returns:
        (masked_text, report_dict)
    """
    if not text:
        return text, PIIReport().to_dict()

    report = PIIReport()

    # Step 1: Deterministic Indian ID Regex Masking
    masked_text = mask_regex_identifiers(text, report)

    # Step 2: Optional NER Masking for Person Names
    if settings.ml_enabled and settings.enable_ner:
        masked_text = mask_ner_entities(masked_text, report)

    return masked_text, report.to_dict()
