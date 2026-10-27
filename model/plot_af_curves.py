import json
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from af_common import EVAL_DIR

FIG = EVAL_DIR / "figures"
FIG.mkdir(parents=True, exist_ok=True)
rows = json.loads((EVAL_DIR / "history_curves_run.json").read_text())
ep = range(1, len(rows) + 1)


def series(key):
    return [r[key] for r in rows if key in r]


for key_pair, ylabel, name in [
    (("loss", "val_loss"), "Loss", "loss_curve.png"),
    (("accuracy", "val_accuracy"), "Window-level accuracy", "accuracy_curve.png"),
]:
    plt.figure(figsize=(6, 4))
    for key, label in zip(key_pair, ("Train", "Validation")):
        if key in rows[0]:
            plt.plot(ep, series(key), marker="o", ms=3, label=label)
    plt.xlabel("Epoch")
    plt.ylabel(ylabel)
    plt.grid(alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig(FIG / name, dpi=200)
    plt.close()

if "val_record_auc" in rows[0]:
    plt.figure(figsize=(6, 4))
    plt.plot(ep, series("val_record_auc"), marker="o", ms=3, color="green")
    plt.xlabel("Epoch")
    plt.ylabel("Validation record-level AUC")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(FIG / "val_auc_curve.png", dpi=200)
    plt.close()
print("curves saved to", FIG)
