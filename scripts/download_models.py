"""
download_hf_models.py
---------------------
Downloads the Hugging Face models chosen for FinLens into  backend/ml_models/<folder>/
and writes ml_models/MODELS_LOCK.json (repo id + exact commit hash) so the app can
pin what it loads.

Usage (run from the FinLens-main folder):
    pip install huggingface_hub
    huggingface-cli login            # only needed for the GATED models (indic tier)
    python download_hf_models.py --tier core          # small, recommended first
    python download_hf_models.py --tier docs          # + document reader (530 MB)
    python download_hf_models.py --tier indic         # + Indian-language translate / speech (large, gated)
    python download_hf_models.py --tier claims        # + car damage classifier
    python download_hf_models.py --tier all
    python download_hf_models.py --tier all --dry-run # just print the plan

Gated models (IndicTrans2, IndicConformer): open each model page while logged in
and click "Agree and access repository" once, otherwise the download returns 401/403.
"""
import argparse
import json
import os
import sys
from datetime import date

# folder name inside ml_models/  ->  (repo id, tier, approx size, note)
MODELS = {
    "multilingual-e5-small": ("intfloat/multilingual-e5-small", "core", "~0.5 GB",
                              "multilingual embeddings: search + cited answers over uploaded documents"),
    "distilbert-NER": ("dslim/distilbert-NER", "core", "~0.3 GB",
                       "finds person / organisation / place names (English) for masking"),
    "granite-docling-258M": ("ibm-granite/granite-docling-258M", "docs", "~0.5 GB",
                             "reads scanned / photographed pages offline (English only)"),
    "indictrans2-en-indic-dist-200M": ("ai4bharat/indictrans2-en-indic-dist-200M", "indic", "~1.1 GB",
                                       "English -> Hindi/Marathi/etc translation (GATED, MIT)"),
    "indictrans2-indic-en-dist-200M": ("ai4bharat/indictrans2-indic-en-dist-200M", "indic", "~0.9 GB",
                                       "Hindi/Marathi/etc -> English translation (GATED, MIT)"),
    "indic-conformer-600m-multilingual": ("ai4bharat/indic-conformer-600m-multilingual", "indic", "~2.5 GB",
                                          "speech-to-text for 22 Indian languages, NO English (GATED)"),
    "car_damage_detection": ("beingamit99/car_damage_detection", "claims", "~0.35 GB",
                             "classifies car photos: crack, scratch, dent, flat tyre, glass, lamp"),
}
TIERS = {"core": ["core"], "docs": ["core", "docs"], "indic": ["core", "indic"],
         "claims": ["core", "claims"], "all": ["core", "docs", "indic", "claims"]}

# skip duplicate weight formats to save disk
IGNORE = ["*.h5", "*.msgpack", "*.ot", "*.onnx", "onnx/*", "openvino/*", "*.tflite", "flax_model*", "tf_model*"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", choices=TIERS, default="core")
    ap.add_argument("--dest", default=os.path.join("backend", "ml_models"))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    wanted = {k: v for k, v in MODELS.items() if v[1] in TIERS[args.tier]}
    print(f"Tier '{args.tier}' -> {len(wanted)} models, destination: {args.dest}\n")
    for folder, (repo, tier, size, note) in wanted.items():
        print(f"  [{tier:6s}] {repo:50s} {size:8s} {note}")
    if args.dry_run:
        print("\n(dry run, nothing downloaded)")
        return

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        sys.exit("Please run: pip install huggingface_hub")
    try:  # pick up HF_TOKEN from backend/.env if it is there (needed for gated models)
        from dotenv import load_dotenv
        load_dotenv(os.path.join("backend", ".env"))
    except ImportError:
        pass

    os.makedirs(args.dest, exist_ok=True)
    lock_path = os.path.join(args.dest, "MODELS_LOCK.json")
    lock = json.load(open(lock_path)) if os.path.exists(lock_path) else {}
    failures = []
    for folder, (repo, tier, size, note) in wanted.items():
        target = os.path.join(args.dest, folder)
        print(f"\n== Downloading {repo} -> {target}")
        try:
            path = snapshot_download(repo_id=repo, local_dir=target, ignore_patterns=IGNORE)
            # the commit hash is recorded in the cache metadata; fall back to 'unknown'
            rev = "unknown"
            try:
                from huggingface_hub import HfApi
                rev = HfApi().model_info(repo).sha
            except Exception:
                pass
            lock[folder] = {"repo": repo, "revision": rev, "downloaded": str(date.today()), "path": path}
            print(f"   OK (revision {rev})")
        except Exception as e:  # gated / network problems
            failures.append((repo, str(e)[:160]))
            print(f"   FAILED: {str(e)[:160]}")

    json.dump(lock, open(lock_path, "w"), indent=2)
    print(f"\nWrote {lock_path}")
    if failures:
        print("\nThese failed (gated models need 'huggingface-cli login' + clicking 'Agree' on the model page):")
        for repo, err in failures:
            print(f"  - {repo}: {err}")
        sys.exit(1)
    print("\nAll done. Make sure backend/ml_models/ is in .gitignore (weights are large).")


if __name__ == "__main__":
    main()
