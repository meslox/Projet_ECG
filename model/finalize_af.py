import json
import time
import numpy as np
import tensorflow as tf
from sklearn.metrics import roc_auc_score, confusion_matrix

from af_common import DATA, MODEL_PATH, EVAL_DIR, WIN, FS, record_probs

EXPORT = MODEL_PATH.parent.parent / "export"
EXPORT.mkdir(parents=True, exist_ok=True)

threshold = json.loads((EVAL_DIR / "threshold.json").read_text())["threshold"]
model = tf.keras.models.load_model(MODEL_PATH, compile=False)

# ---- representative data for INT8 calibration (training windows only) ----
Xtr = np.load(DATA / "X_train.npy", mmap_mode="r")
rng = np.random.default_rng(0)
idx = np.sort(rng.choice(len(Xtr), 300, replace=False))
calib = np.asarray(Xtr[idx], dtype=np.float32)


def rep_data():
    for i in range(len(calib)):
        yield [calib[i : i + 1]]


# ---- export ----
conv = tf.lite.TFLiteConverter.from_keras_model(model)
fp32_bytes = conv.convert()
(EXPORT / "af_cnn_se_fp32.tflite").write_bytes(fp32_bytes)

conv = tf.lite.TFLiteConverter.from_keras_model(model)
conv.optimizations = [tf.lite.Optimize.DEFAULT]
conv.representative_dataset = rep_data
conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
try:
    int8_bytes = conv.convert()
    int8_kind = "full-integer INT8"
except Exception as e:  # fall back to dynamic-range quantization
    print("Full INT8 conversion failed:", repr(e)[:300])
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    int8_bytes = conv.convert()
    int8_kind = "dynamic-range INT8 (fallback)"
(EXPORT / "af_cnn_se_int8.tflite").write_bytes(int8_bytes)
print(
    f"fp32: {len(fp32_bytes) / 1024:.0f} KB   int8 ({int8_kind}): {len(int8_bytes) / 1024:.0f} KB"
)


def tflite_probs(content, X):
    interp = tf.lite.Interpreter(model_content=content)
    interp.allocate_tensors()
    inp, out = interp.get_input_details()[0], interp.get_output_details()[0]
    assert inp["dtype"] == np.float32, f"unexpected input dtype {inp['dtype']}"
    p = np.empty(len(X), np.float32)
    for i in range(len(X)):
        interp.set_tensor(inp["index"], X[i : i + 1].astype(np.float32))
        interp.invoke()
        p[i] = interp.get_tensor(out["index"]).ravel()[0]
    return p


def metrics(y, rp):
    pred = (rp >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return dict(
        acc=float((tp + tn) / len(y)),
        sens=float(tp / max(tp + fn, 1)),
        spec=float(tn / max(tn + fp, 1)),
        auc=float(roc_auc_score(y, rp)),
    )


results = {}
for split in ("val", "test"):
    X = np.load(DATA / f"X_{split}.npy")
    ridx = np.load(DATA / f"recidx_{split}.npy")
    y = np.load(DATA / f"yrec_{split}.npy")
    probs = {
        "keras": model.predict(X, batch_size=128, verbose=0).ravel(),
        "fp32": tflite_probs(fp32_bytes, X),
        "int8": tflite_probs(int8_bytes, X),
    }
    results[split] = {
        k: metrics(y, record_probs(p, ridx, len(y))) for k, p in probs.items()
    }
    print(f"\n{split} (record level, threshold {threshold:.3f})")
    for k, m in results[split].items():
        print(
            f"  {k:>5}: acc {m['acc']:.4f}  sens {m['sens']:.4f}  "
            f"spec {m['spec']:.4f}  auc {m['auc']:.4f}"
        )

# ---- latency on THIS computer (the Pi must be measured separately) ----
interp = tf.lite.Interpreter(model_content=int8_bytes)
interp.allocate_tensors()
inp = interp.get_input_details()[0]
x = calib[:1]
for _ in range(5):
    interp.set_tensor(inp["index"], x)
    interp.invoke()
t0 = time.perf_counter()
for _ in range(100):
    interp.set_tensor(inp["index"], x)
    interp.invoke()
lat_ms = (time.perf_counter() - t0) / 100 * 1000
print(f"\nINT8 latency on this PC: {lat_ms:.2f} ms per 10 s window")

card = {
    "task": "Normal vs AF, PhysioNet/CinC 2017 training data",
    "sampling_rate_hz": FS,
    "window_samples": WIN,
    "preprocess": "bandpass 0.5-40 Hz (order 3, filtfilt), per-window z-score",
    "aggregation": "mean window probability over non-overlapping 10 s windows",
    "threshold": threshold,
    "files": {"fp32": "af_cnn_se_fp32.tflite", "int8": "af_cnn_se_int8.tflite"},
    "int8_kind": int8_kind,
    "size_kb": {"fp32": len(fp32_bytes) / 1024, "int8": len(int8_bytes) / 1024},
    "pc_latency_ms_int8": lat_ms,
    "results": results,
    "limitations": "Other and Noisy recordings excluded; no patient IDs; "
    "single device type; screening aid, not a diagnostic device",
}
(EXPORT / "af_model_card.json").write_text(json.dumps(card, indent=2))
print("saved to", EXPORT)
