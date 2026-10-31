"""
verify_ml.py
------------
Verifies local ML model downloads by running a single tiny test inference on each
available model in backend/ml_models/. Prints OK/FAIL, inference time, and RAM.
Requires no running server.
"""

import gc
import json
import os
import sys
import time

# Ensure backend directory is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

try:
    import psutil
except ImportError:
    psutil = None

def get_ram_mb() -> float:
    if psutil:
        return round(psutil.Process().memory_info().rss / (1024 * 1024), 2)
    return 0.0

MODELS_DIR = os.path.join(BACKEND_DIR, "ml_models")


def verify_embeddings(folder: str):
    from sentence_transformers import SentenceTransformer
    start_time = time.time()
    model = SentenceTransformer(folder, local_files_only=True, device="cpu")
    vec = model.encode(["passage: test query"], normalize_embeddings=True)
    elapsed = round(time.time() - start_time, 2)
    dim = len(vec[0])
    del model
    gc.collect()
    return f"OK (dim={dim}, time={elapsed}s, RAM={get_ram_mb()} MB)"


def verify_ner(folder: str):
    from transformers import AutoModelForTokenClassification, AutoTokenizer, pipeline
    start_time = time.time()
    tok = AutoTokenizer.from_pretrained(folder, local_files_only=True)
    mod = AutoModelForTokenClassification.from_pretrained(folder, local_files_only=True)
    pipe = pipeline("ner", model=mod, tokenizer=tok, aggregation_strategy="simple", device=-1)
    res = pipe("State Bank of India approved loan for Ramesh Kumar in Delhi.")
    elapsed = round(time.time() - start_time, 2)
    del tok, mod, pipe
    gc.collect()
    return f"OK (found {len(res)} entities, time={elapsed}s, RAM={get_ram_mb()} MB)"


def verify_docling(folder: str):
    from PIL import Image
    from transformers import AutoProcessor
    try:
        from transformers import AutoModelForImageTextToText as AutoVisionModel
    except ImportError:
        from transformers import AutoModelForVision2Seq as AutoVisionModel

    start_time = time.time()
    processor = AutoProcessor.from_pretrained(folder, local_files_only=True)
    model = AutoVisionModel.from_pretrained(folder, local_files_only=True)
    model.eval()
    dummy_img = Image.new("RGB", (128, 128), color="white")
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": "Convert this page to docling."}
            ]
        }
    ]
    prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=prompt, images=[dummy_img], return_tensors="pt")
    # Quick generation with max_new_tokens=4 just to verify forward pass
    _ = model.generate(**inputs, max_new_tokens=4)

    elapsed = round(time.time() - start_time, 2)
    del processor, model, dummy_img, inputs
    gc.collect()
    return f"OK (vision-text passed, time={elapsed}s, RAM={get_ram_mb()} MB)"



def verify_car_damage(folder: str):
    from PIL import Image
    from transformers import pipeline
    start_time = time.time()
    pipe = pipeline("image-classification", model=folder, device=-1, local_files_only=True)
    dummy_img = Image.new("RGB", (128, 128), color="white")
    res = pipe(dummy_img, top_k=2)
    elapsed = round(time.time() - start_time, 2)
    del pipe, dummy_img
    gc.collect()
    return f"OK (classes={len(res)}, time={elapsed}s, RAM={get_ram_mb()} MB)"


VERIFIERS = {
    "multilingual-e5-small": ("Multilingual E5 Embeddings", verify_embeddings),
    "distilbert-NER": ("DistilBERT Named Entity Recognition", verify_ner),
    "granite-docling-258M": ("Granite Docling Document Reader", verify_docling),
    "car_damage_detection": ("Car Damage Detection Classifier", verify_car_damage),
}


def main():
    print(f"=== FinLens AI Model Verification ===")
    print(f"Scanning models in: {MODELS_DIR}\n")

    if not os.path.exists(MODELS_DIR):
        print(f"Directory {MODELS_DIR} does not exist. Run scripts/download_models.py first.")
        sys.exit(1)

    lock_path = os.path.join(MODELS_DIR, "MODELS_LOCK.json")
    if os.path.exists(lock_path):
        with open(lock_path, "r") as f:
            lock = json.load(f)
            print(f"MODELS_LOCK.json loaded ({len(lock)} locked revisions).")

    results = []
    for folder_name, (label, verifier_fn) in VERIFIERS.items():
        folder_path = os.path.join(MODELS_DIR, folder_name)
        if not os.path.exists(folder_path) or not os.listdir(folder_path):
            print(f"[-] {label:38s}: SKIPPED (not downloaded)")
            results.append((label, "SKIPPED"))
            continue

        print(f"[*] Testing {label} ({folder_name})...", end=" ", flush=True)
        try:
            msg = verifier_fn(folder_path)
            print(msg)
            results.append((label, "OK"))
        except Exception as e:
            print(f"FAIL ({type(e).__name__}: {e})")
            results.append((label, f"FAIL: {e}"))

    print("\n=== Summary ===")
    all_ok = True
    for label, status in results:
        status_str = "OK" if status == "OK" else status
        print(f"  {label:38s}: {status_str}")
        if status.startswith("FAIL"):
            all_ok = False

    if not all_ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
