import argparse
import json
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy.signal import butter, filtfilt, resample_poly

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    try:
        from tflite_runtime.interpreter import Interpreter
    except ImportError:
        import tensorflow as tf

        Interpreter = tf.lite.Interpreter

HERE = Path(__file__).parent
FS, WIN = 300, 3000

ap = argparse.ArgumentParser()
ap.add_argument("csv", help="one column of raw ECG samples")
ap.add_argument("--fs", type=float, required=True, help="sampling rate of the CSV")
ap.add_argument("--model", default="af_cnn_se_int8.tflite")
args = ap.parse_args()

card = json.loads((HERE / "af_model_card.json").read_text())
threshold = card["threshold"]

sig = np.loadtxt(args.csv, dtype=np.float64).ravel()
if abs(args.fs - FS) > 1e-6:
    r = Fraction(FS / args.fs).limit_denominator(1000)
    sig = resample_poly(sig, r.numerator, r.denominator)
b, a = butter(3, [0.5 / (FS / 2), 40.0 / (FS / 2)], btype="band")
sig = filtfilt(b, a, sig)

n = len(sig) // WIN
if n < 1:
    raise SystemExit("Need at least 10 seconds of ECG.")
wins = [sig[i * WIN : (i + 1) * WIN] for i in range(n)]
if min(w.std() for w in wins) < 1e-6:
    print("WARNING: flat segment found, check electrode contact")

interp = Interpreter(model_path=str(HERE / args.model))
interp.allocate_tensors()
inp, out = interp.get_input_details()[0], interp.get_output_details()[0]
probs = []
for w in wins:
    x = ((w - w.mean()) / (w.std() + 1e-8)).astype(np.float32).reshape(1, WIN, 1)
    interp.set_tensor(inp["index"], x)
    interp.invoke()
    probs.append(float(interp.get_tensor(out["index"]).ravel()[0]))

p = float(np.mean(probs))
print(f"windows: {n}  mean AF probability: {p:.3f}  threshold: {threshold:.3f}")
print(
    "RESULT:",
    "possible AF, confirm with a clinician" if p >= threshold else "no AF detected",
)
