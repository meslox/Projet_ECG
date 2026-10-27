import json
import csv
import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import tensorflow as tf
from sklearn.metrics import (
    confusion_matrix,
    roc_curve,
    roc_auc_score,
    precision_recall_curve,
    average_precision_score,
    cohen_kappa_score,
    matthews_corrcoef,
    f1_score,
    balanced_accuracy_score,
)

from af_common import DATA, MODEL_PATH, EVAL_DIR, record_probs

FIG = EVAL_DIR / "figures"
FIG.mkdir(parents=True, exist_ok=True)
NAMES = ["Normal", "AF"]

t = json.loads((EVAL_DIR / "threshold.json").read_text())["threshold"]
model = tf.keras.models.load_model(MODEL_PATH, compile=False)
X = np.load(DATA / "X_test.npy")
ridx = np.load(DATA / "recidx_test.npy")
y = np.load(DATA / "yrec_test.npy")

p = model.predict(X, batch_size=128, verbose=0).ravel()
rp = record_probs(p, ridx, len(y))
pred = (rp >= t).astype(int)

cm = confusion_matrix(y, pred, labels=[0, 1])
tn, fp, fn, tp = cm.ravel()
prec = tp / max(tp + fp, 1)
sens = tp / max(tp + fn, 1)
metrics = {
    "accuracy": (tp + tn) / len(y),
    "sensitivity (recall)": sens,
    "specificity": tn / max(tn + fp, 1),
    "precision": prec,
    "F1": f1_score(y, pred),
    "Cohen kappa": cohen_kappa_score(y, pred),
    "MCC": matthews_corrcoef(y, pred),
    "balanced accuracy": balanced_accuracy_score(y, pred),
    "ROC AUC": roc_auc_score(y, rp),
    "average precision": average_precision_score(y, rp),
}
print(f"test records {len(y)} (AF={int(y.sum())}), threshold {t:.3f}")
for k, v in metrics.items():
    print(f"{k:>22}: {v:.4f}")
with open(FIG / "metrics.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["metric", "value"])
    for k, v in metrics.items():
        w.writerow([k, f"{v:.4f}"])

# 1) confusion matrix: counts and row-normalised
fig, axes = plt.subplots(1, 2, figsize=(9, 4))
for ax, data, title, fmt in [
    (axes[0], cm, "Counts", "d"),
    (axes[1], cm / cm.sum(axis=1, keepdims=True), "Row-normalised", ".2f"),
]:
    ax.imshow(data, cmap="Blues")
    ax.set_xticks([0, 1])
    ax.set_xticklabels(NAMES)
    ax.set_yticks([0, 1])
    ax.set_yticklabels(NAMES)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    for i in range(2):
        for j in range(2):
            ax.text(
                j,
                i,
                format(data[i, j], fmt),
                ha="center",
                va="center",
                color="white" if data[i, j] > data.max() / 2 else "black",
                fontsize=13,
            )
fig.tight_layout()
fig.savefig(FIG / "confusion_matrix.png", dpi=200)
plt.close(fig)

# 2) ROC curve with the chosen operating point
fpr, tpr, _ = roc_curve(y, rp)
plt.figure(figsize=(5, 5))
plt.plot(fpr, tpr, label=f"AUC = {metrics['ROC AUC']:.3f}")
plt.plot([0, 1], [0, 1], "--", color="gray")
plt.scatter(
    [fp / max(fp + tn, 1)], [sens], color="red", zorder=3, label=f"threshold {t:.2f}"
)
plt.xlabel("False positive rate")
plt.ylabel("True positive rate (sensitivity)")
plt.title("ROC curve (test records)")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.savefig(FIG / "roc_curve.png", dpi=200)
plt.close()

# 3) precision-recall curve
pr, rc, _ = precision_recall_curve(y, rp)
plt.figure(figsize=(5, 5))
plt.plot(rc, pr, label=f"AP = {metrics['average precision']:.3f}")
plt.axhline(y.mean(), ls="--", color="gray", label=f"baseline {y.mean():.2f}")
plt.scatter([sens], [prec], color="red", zorder=3, label=f"threshold {t:.2f}")
plt.xlabel("Recall")
plt.ylabel("Precision")
plt.title("Precision-recall curve (test records)")
plt.legend()
plt.grid(alpha=0.3)
plt.tight_layout()
plt.savefig(FIG / "pr_curve.png", dpi=200)
plt.close()

# 4) predicted probability by class
plt.figure(figsize=(6, 4))
bins = np.linspace(0, 1, 26)
plt.hist(rp[y == 0], bins=bins, alpha=0.7, label="Normal")
plt.hist(rp[y == 1], bins=bins, alpha=0.7, label="AF")
plt.axvline(t, color="red", ls="--", label=f"threshold {t:.2f}")
plt.yscale("log")
plt.xlabel("Mean AF probability per record")
plt.ylabel("Records (log scale)")
plt.title("Score distribution")
plt.legend()
plt.tight_layout()
plt.savefig(FIG / "score_histogram.png", dpi=200)
plt.close()

# 5) metric summary bars
keys = [
    "accuracy",
    "sensitivity (recall)",
    "specificity",
    "precision",
    "F1",
    "Cohen kappa",
    "ROC AUC",
]
plt.figure(figsize=(8, 4))
vals = [metrics[k] for k in keys]
plt.bar(range(len(keys)), vals, color="#3b78b8")
for i, v in enumerate(vals):
    plt.text(i, v + 0.01, f"{v:.3f}", ha="center")
plt.xticks(range(len(keys)), keys, rotation=25, ha="right")
plt.ylim(0, 1.1)
plt.title("Test-set metrics")
plt.tight_layout()
plt.savefig(FIG / "metrics_summary.png", dpi=200)
plt.close()
print("figures saved to", FIG)
