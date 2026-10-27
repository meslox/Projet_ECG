import argparse
import json
import numpy as np
import tensorflow as tf
from sklearn.metrics import roc_auc_score, confusion_matrix

from af_common import DATA, MODEL_PATH, EVAL_DIR, record_probs

ap = argparse.ArgumentParser()
ap.add_argument(
    "--final",
    action="store_true",
    help="confirm tuning is finished; evaluate the test split once",
)
args = ap.parse_args()
if not args.final:
    raise SystemExit("Refusing to touch the test split without --final.")

X = np.load(DATA / "X_test.npy")
ridx = np.load(DATA / "recidx_test.npy")
y = np.load(DATA / "yrec_test.npy")
t = json.loads((EVAL_DIR / "threshold.json").read_text())["threshold"]

model = tf.keras.models.load_model(MODEL_PATH, compile=False)
p = model.predict(X, batch_size=128, verbose=0).ravel()
rp = record_probs(p, ridx, len(y))
pred = (rp >= t).astype(int)


def metrics(yt, pr, rpp):
    tn, fp, fn, tp = confusion_matrix(yt, pr, labels=[0, 1]).ravel()
    sens = tp / max(tp + fn, 1)
    spec = tn / max(tn + fp, 1)
    prec = tp / max(tp + fp, 1)
    f1 = 2 * prec * sens / max(prec + sens, 1e-9)
    return dict(
        acc=(tp + tn) / len(yt),
        sens=sens,
        spec=spec,
        prec=prec,
        f1=f1,
        auc=roc_auc_score(yt, rpp),
    )


m = metrics(y, pred, rp)
rng = np.random.default_rng(0)
boots = []
for _ in range(1000):
    i = rng.integers(0, len(y), len(y))
    if y[i].min() == y[i].max():
        continue
    boots.append(metrics(y[i], pred[i], rp[i]))
lines = [
    f"test records: {len(y)} (AF={int(y.sum())})  threshold {t:.3f}",
    f"always-normal accuracy: {1 - y.mean():.4f}",
]
for k in ("acc", "sens", "spec", "prec", "f1", "auc"):
    lo, hi = np.percentile([b[k] for b in boots], [2.5, 97.5])
    lines.append(f"{k:>5}: {m[k]:.4f}  (95% CI {lo:.4f} - {hi:.4f})")
lines.append("confusion matrix rows=true [N, AF], cols=pred:")
lines.append(str(confusion_matrix(y, pred, labels=[0, 1])))
text = "\n".join(lines)
print(text)
EVAL_DIR.mkdir(parents=True, exist_ok=True)
(EVAL_DIR / "test_report.txt").write_text(text)
