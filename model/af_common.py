from pathlib import Path
import numpy as np

ROOT = Path.home() / "final_year_project"
SRC = ROOT / "dataset" / "physionet2017" / "training2017"
DATA = ROOT / "dataset" / "af_prepared"
MODEL_PATH = ROOT / "model" / "saved_models" / "af_cnn_se.keras"
EVAL_DIR = ROOT / "evaluation" / "af"

FS = 300
WIN = 10 * FS


def record_probs(win_probs, rec_idx, n_rec):
    """Mean window probability per record. rec_idx runs 0..n_rec-1."""
    sums = np.bincount(rec_idx, weights=win_probs, minlength=n_rec)
    counts = np.bincount(rec_idx, minlength=n_rec)
    return sums / np.maximum(counts, 1)
