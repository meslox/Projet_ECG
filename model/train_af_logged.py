import json
import numpy as np
import tensorflow as tf

from af_common import DATA, MODEL_PATH, EVAL_DIR
from train_af import build_model, RecordAUC, EPOCHS, BATCH  # sets the same seeds


class EpochLog(tf.keras.callbacks.Callback):
    def __init__(self):
        super().__init__()
        self.rows = []

    def on_epoch_end(self, epoch, logs=None):
        self.rows.append({k: float(v) for k, v in (logs or {}).items()})


Xtr = np.load(DATA / "X_train.npy")
ytr = np.load(DATA / "ywin_train.npy")
Xva = np.load(DATA / "X_val.npy")
yva_win = np.load(DATA / "ywin_val.npy")
rva = np.load(DATA / "recidx_val.npy")
yva = np.load(DATA / "yrec_val.npy")

n0, n1 = int((ytr == 0).sum()), int((ytr == 1).sum())
cw = {0: 1.0, 1: float(np.sqrt(n0 / n1))}

model = build_model()
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss="binary_crossentropy",
    metrics=["accuracy"],
)
auc_cb = RecordAUC(Xva, rva, yva)
lr_cb = tf.keras.callbacks.ReduceLROnPlateau(
    monitor="loss", factor=0.5, patience=3, min_lr=1e-5
)
log_cb = EpochLog()  # last, so it sees the val_record_auc added by auc_cb
model.fit(
    Xtr,
    ytr,
    batch_size=BATCH,
    epochs=EPOCHS,
    class_weight=cw,
    validation_data=(Xva, yva_win),
    callbacks=[auc_cb, lr_cb, log_cb],
    verbose=2,
)

EVAL_DIR.mkdir(parents=True, exist_ok=True)
(EVAL_DIR / "history_curves_run.json").write_text(json.dumps(log_cb.rows))
model.save(MODEL_PATH.parent / "af_cnn_se_curves_run.keras")
print("saved history to", EVAL_DIR / "history_curves_run.json")
