"""
Indic Languages Service for FinLens AI.
Provides IndicTrans2 (Distilled) translation and IndicConformer multilingual ASR
when the local gated weights are downloaded. Falls back cleanly to Gemini/Sarvam when absent.
"""

import io
import logging
from typing import List, Optional

from config import settings
from services.ml.registry import registry

logger = logging.getLogger(__name__)

LANG_MAP_INDICTRANS = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "mr": "mar_Deva",
    "bn": "ben_Beng",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "gu": "guj_Gujr",
    "kn": "kan_Knda",
}


def translate_text(
    text: str,
    src_lang: str = "en",
    tgt_lang: str = "mr",
    batch_size: int = 8,
) -> Optional[str]:
    """
    Translates text between English and Indian languages using IndicTrans2.
    Processes sentences in batches of at most 8.
    Preserves numbers, punctuation and rupee/currency symbols.
    Returns translated text or None if model is unavailable.
    """
    if not text or not text.strip():
        return text

    if src_lang == tgt_lang:
        return text

    is_en_to_indic = src_lang == "en"
    model_name = "indic_translate_en_indic" if is_en_to_indic else "indic_translate_indic_en"

    bundle = registry.get(model_name)
    if bundle is None:
        return None

    try:
        tokenizer = bundle["tokenizer"]
        model = bundle["model"]
        ip = bundle["ip"]

        src_code = LANG_MAP_INDICTRANS.get(src_lang, f"{src_lang}_Deva")
        tgt_code = LANG_MAP_INDICTRANS.get(tgt_lang, f"{tgt_lang}_Deva")

        # Split into sentences (rudimentary punctuation split)
        import re
        raw_sentences = [s.strip() for s in re.split(r"(?<=[.!?\n])\s+", text) if s.strip()]
        if not raw_sentences:
            raw_sentences = [text]

        translated_sentences: List[str] = []

        for i in range(0, len(raw_sentences), batch_size):
            batch = raw_sentences[i : i + batch_size]
            preprocessed_batch = ip.preprocess_batch(batch, src_lang=src_code, tgt_lang=tgt_code)
            inputs = tokenizer(
                preprocessed_batch,
                src_lang=src_code,
                tgt_lang=tgt_code,
                return_tensors="pt",
                padding=True,
                truncation=True,
            )
            if hasattr(model, "device"):
                inputs = inputs.to(model.device)

            with torch.no_grad():
                generated_tokens = model.generate(
                    **inputs,
                    use_cache=True,
                    min_length=0,
                    max_length=256,
                    num_beams=4,
                    num_return_sequences=1,
                )

            with tokenizer.as_target_tokenizer():
                decoded = tokenizer.batch_decode(
                    generated_tokens.detach().cpu().tolist(),
                    skip_special_tokens=True,
                    clean_up_tokenization_spaces=True,
                )

            postprocessed = ip.postprocess_batch(decoded, lang=tgt_code)
            translated_sentences.extend(postprocessed)

        return " ".join(translated_sentences)
    except Exception as e:
        logger.error(f"IndicTrans2 translation failed: {e}")
        return None


def transcribe_audio_indic(audio_bytes: bytes, language: str = "hi") -> Optional[str]:
    """
    Transcribes audio (up to ML_MAX_AUDIO_SECONDS) using IndicConformer.
    Resamples to 16kHz mono using torchaudio.
    """
    bundle = registry.get("indic_asr")
    if bundle is None:
        return None

    try:
        import torch
        import torchaudio

        processor = bundle["processor"]
        model = bundle["model"]

        # Load waveform
        waveform, sample_rate = torchaudio.load(io.BytesIO(audio_bytes))

        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)

        # Resample to 16 kHz
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
            waveform = resampler(waveform)

        inputs = processor(waveform.squeeze().numpy(), sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            logits = model(**inputs).logits

        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = processor.batch_decode(predicted_ids)[0]
        return transcription.strip()
    except Exception as e:
        logger.error(f"IndicConformer ASR failed: {e}")
        return None
