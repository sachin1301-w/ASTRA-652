"""
Thread-safe lazy loader and lifecycle manager for local ML models in FinLens AI.
Ensures local-only execution, memory safety (at most one heavy model loaded at once),
idle timeouts, and graceful fallbacks when models/libraries are unavailable.
"""

import gc
import json
import logging
import os
import threading
import time
from typing import Any, Callable, Dict, Optional

import psutil

from config import settings

logger = logging.getLogger(__name__)

# Enforce offline loading for Hugging Face to guarantee no runtime network downloads
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# Base path for models
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_BASE_DIR = os.path.join(BACKEND_DIR, settings.ml_models_dir)
LOCK_FILE_PATH = os.path.join(MODELS_BASE_DIR, "MODELS_LOCK.json")

# Heavy models that cannot reside in memory simultaneously on resource-constrained hosts
HEAVY_MODELS = {
    "docling",
    "indic_translate_en_indic",
    "indic_translate_indic_en",
    "indic_asr",
}


def _get_process_ram_mb() -> float:
    try:
        process = psutil.Process()
        return round(process.memory_info().rss / (1024 * 1024), 2)
    except Exception:
        return 0.0


def _load_models_lock() -> dict:
    if os.path.exists(LOCK_FILE_PATH):
        try:
            with open(LOCK_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read MODELS_LOCK.json: {e}")
    return {}


class ModelDescriptor:
    def __init__(
        self,
        name: str,
        folder_name: str,
        flag_getter: Callable[[], bool],
        loader_fn: Callable[[str], Any],
        is_heavy: bool = False,
    ):
        self.name = name
        self.folder_name = folder_name
        self.flag_getter = flag_getter
        self.loader_fn = loader_fn
        self.is_heavy = is_heavy
        self.instance: Any = None
        self.loaded_at: float = 0.0
        self.last_used_at: float = 0.0
        self.last_error: Optional[str] = None


# --- Individual Model Loaders (local_files_only=True) ---

def _load_embeddings(folder_path: str) -> Any:
    """Loads multilingual-e5-small for document embeddings and semantic search."""
    from sentence_transformers import SentenceTransformer
    # Load strictly from local weights
    return SentenceTransformer(folder_path, device=settings.ml_device, local_files_only=True)


def _load_ner(folder_path: str) -> Any:
    """Loads distilbert-NER pipeline for PII name masking."""
    from transformers import AutoModelForTokenClassification, AutoTokenizer, pipeline
    tokenizer = AutoTokenizer.from_pretrained(folder_path, local_files_only=True)
    model = AutoModelForTokenClassification.from_pretrained(folder_path, local_files_only=True)
    return pipeline(
        "ner",
        model=model,
        tokenizer=tokenizer,
        aggregation_strategy="simple",
        device=-1 if settings.ml_device == "cpu" else 0,
    )


def _load_docling(folder_path: str) -> Any:
    """Loads granite-docling-258M vision2seq/image-text model and processor for offline scanned document OCR."""
    from transformers import AutoProcessor
    try:
        from transformers import AutoModelForImageTextToText as AutoVisionModel
    except ImportError:
        from transformers import AutoModelForVision2Seq as AutoVisionModel

    processor = AutoProcessor.from_pretrained(folder_path, local_files_only=True)
    model = AutoVisionModel.from_pretrained(
        folder_path,
        local_files_only=True,
        torch_dtype="auto",
    )
    model.eval()
    return {"processor": processor, "model": model}



def _load_indic_translate_en_indic(folder_path: str) -> Any:
    """
    Loads IndicTrans2 EN->Indic model.
    NOTE: trust_remote_code=True is permitted ONLY for IndicTrans2 and IndicConformer
    models, and loaded strictly from the local folder pinned by ml_models/MODELS_LOCK.json.
    """
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    from IndicTransToolkit import IndicProcessor
    tokenizer = AutoTokenizer.from_pretrained(folder_path, local_files_only=True, trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(folder_path, local_files_only=True, trust_remote_code=True)
    ip = IndicProcessor(inference=True)
    model.eval()
    return {"tokenizer": tokenizer, "model": model, "ip": ip}


def _load_indic_translate_indic_en(folder_path: str) -> Any:
    """
    Loads IndicTrans2 Indic->EN model.
    NOTE: trust_remote_code=True is permitted ONLY for IndicTrans2 and IndicConformer
    models, and loaded strictly from the local folder pinned by ml_models/MODELS_LOCK.json.
    """
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    from IndicTransToolkit import IndicProcessor
    tokenizer = AutoTokenizer.from_pretrained(folder_path, local_files_only=True, trust_remote_code=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(folder_path, local_files_only=True, trust_remote_code=True)
    ip = IndicProcessor(inference=True)
    model.eval()
    return {"tokenizer": tokenizer, "model": model, "ip": ip}


def _load_indic_asr(folder_path: str) -> Any:
    """
    Loads IndicConformer ASR model for Indian languages.
    NOTE: trust_remote_code=True is permitted ONLY for IndicTrans2 and IndicConformer
    models, and loaded strictly from the local folder pinned by ml_models/MODELS_LOCK.json.
    """
    from transformers import AutoModelForCTC, AutoProcessor
    processor = AutoProcessor.from_pretrained(folder_path, local_files_only=True, trust_remote_code=True)
    model = AutoModelForCTC.from_pretrained(folder_path, local_files_only=True, trust_remote_code=True)
    model.eval()
    return {"processor": processor, "model": model}


def _load_car_damage(folder_path: str) -> Any:
    """Loads car damage ViT classifier."""
    from transformers import pipeline
    return pipeline(
        "image-classification",
        model=folder_path,
        device=-1 if settings.ml_device == "cpu" else 0,
        local_files_only=True,
    )


def _load_loan_model(folder_path: str) -> Any:
    """Loads user's own trained loan approval model pipeline."""
    from services.ml.credit_service import LoanPredictor
    model_file = os.path.join(folder_path, "loan_model.pkl")
    meta_file = os.path.join(folder_path, "loan_model_meta.json")
    return LoanPredictor(model_file, meta_file)


def _load_fraud_model(folder_path: str) -> Any:
    """Loads user's own trained fraud detection model pipeline."""
    from services.ml.credit_service import FraudChecker
    model_file = os.path.join(folder_path, "fraud_model.pkl")
    meta_file = os.path.join(folder_path, "fraud_model_meta.json")
    return FraudChecker(model_file, meta_file)


class ModelRegistry:
    def __init__(self):
        self._lock = threading.RLock()
        self._models: Dict[str, ModelDescriptor] = {
            "embeddings": ModelDescriptor(
                name="embeddings",
                folder_name="multilingual-e5-small",
                flag_getter=lambda: settings.enable_embeddings,
                loader_fn=_load_embeddings,
                is_heavy=False,
            ),
            "ner": ModelDescriptor(
                name="ner",
                folder_name="distilbert-NER",
                flag_getter=lambda: settings.enable_ner,
                loader_fn=_load_ner,
                is_heavy=False,
            ),
            "docling": ModelDescriptor(
                name="docling",
                folder_name="granite-docling-258M",
                flag_getter=lambda: settings.enable_docling,
                loader_fn=_load_docling,
                is_heavy=True,
            ),
            "indic_translate_en_indic": ModelDescriptor(
                name="indic_translate_en_indic",
                folder_name="indictrans2-en-indic-dist-200M",
                flag_getter=lambda: settings.enable_indic_translate,
                loader_fn=_load_indic_translate_en_indic,
                is_heavy=True,
            ),
            "indic_translate_indic_en": ModelDescriptor(
                name="indic_translate_indic_en",
                folder_name="indictrans2-indic-en-dist-200M",
                flag_getter=lambda: settings.enable_indic_translate,
                loader_fn=_load_indic_translate_indic_en,
                is_heavy=True,
            ),
            "indic_asr": ModelDescriptor(
                name="indic_asr",
                folder_name="indic-conformer-600m-multilingual",
                flag_getter=lambda: settings.enable_indic_asr,
                loader_fn=_load_indic_asr,
                is_heavy=True,
            ),
            "car_damage": ModelDescriptor(
                name="car_damage",
                folder_name="car_damage_detection",
                flag_getter=lambda: settings.enable_car_damage,
                loader_fn=_load_car_damage,
                is_heavy=False,
            ),
            "loan": ModelDescriptor(
                name="loan",
                folder_name="loan",
                flag_getter=lambda: True,
                loader_fn=_load_loan_model,
                is_heavy=False,
            ),
            "fraud": ModelDescriptor(
                name="fraud",
                folder_name="fraud",
                flag_getter=lambda: True,
                loader_fn=_load_fraud_model,
                is_heavy=False,
            ),
        }

    def _unload_descriptor(self, desc: ModelDescriptor) -> None:
        if desc.instance is not None:
            logger.info(f"Unloading ML model '{desc.name}' from RAM")
            desc.instance = None
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass

    def _check_idle_unloads(self) -> None:
        """Unload any model idle longer than ML_IDLE_UNLOAD_SECONDS."""
        now = time.time()
        timeout = settings.ml_idle_unload_seconds
        for desc in self._models.values():
            if desc.instance is not None and (now - desc.last_used_at > timeout):
                logger.info(f"Model '{desc.name}' idle for >{timeout}s. Unloading.")
                self._unload_descriptor(desc)

    def get(self, name: str) -> Optional[Any]:
        """
        Thread-safe lazy loader. Returns None (never raises) if disabled, missing folder,
        import error or load error; logs one clear warning.
        Loads at most one heavy model at a time.
        """
        if not settings.ml_enabled:
            return None

        with self._lock:
            self._check_idle_unloads()

            desc = self._models.get(name)
            if not desc:
                logger.warning(f"Requested unknown ML model: '{name}'")
                return None

            if not desc.flag_getter():
                return None

            folder_path = os.path.join(MODELS_BASE_DIR, desc.folder_name)
            if not os.path.isdir(folder_path):
                desc.last_error = f"Model directory not found: {desc.folder_name}"
                return None

            # If already cached, update timestamp and return
            if desc.instance is not None:
                desc.last_used_at = time.time()
                return desc.instance

            # Enforce at most one heavy model at a time
            if desc.is_heavy:
                for other_name, other_desc in self._models.items():
                    if other_desc.is_heavy and other_desc.instance is not None:
                        logger.info(f"Unloading heavy model '{other_name}' to load '{name}'")
                        self._unload_descriptor(other_desc)

            start_ram = _get_process_ram_mb()
            start_time = time.time()

            try:
                logger.info(f"Loading ML model '{name}' from {folder_path} (Current RAM: {start_ram} MB)...")
                desc.instance = desc.loader_fn(folder_path)
                desc.loaded_at = time.time()
                desc.last_used_at = time.time()
                desc.last_error = None
                elapsed = round(time.time() - start_time, 2)
                end_ram = _get_process_ram_mb()
                logger.info(f"Loaded ML model '{name}' in {elapsed}s. Process RAM: {end_ram} MB (delta: +{round(end_ram - start_ram, 2)} MB)")
                return desc.instance
            except Exception as e:
                err_msg = f"{type(e).__name__}: {str(e)}"
                desc.last_error = err_msg
                desc.instance = None
                logger.warning(f"Failed to load ML model '{name}': {err_msg}")
                return None

    def get_status(self) -> dict:
        """Returns structured status of all ML models, device, and RAM."""
        with self._lock:
            self._check_idle_unloads()
            lock_info = _load_models_lock()
            models_status = {}

            for name, desc in self._models.items():
                folder_path = os.path.join(MODELS_BASE_DIR, desc.folder_name)
                folder_exists = os.path.isdir(folder_path)
                files_present = False
                if folder_exists:
                    try:
                        files = os.listdir(folder_path)
                        files_present = len(files) > 0
                    except Exception:
                        files_present = False

                available = folder_exists and files_present
                revision = lock_info.get(desc.folder_name, {}).get("revision", "unknown") if available else None

                models_status[name] = {
                    "enabled": bool(settings.ml_enabled and desc.flag_getter()),
                    "available": available,
                    "loaded": desc.instance is not None,
                    "folder": desc.folder_name,
                    "revision": revision,
                    "last_error": desc.last_error,
                }

            return {
                "ml_enabled": settings.ml_enabled,
                "device": settings.ml_device,
                "ram_used_mb": _get_process_ram_mb(),
                "models": models_status,
            }


registry = ModelRegistry()
