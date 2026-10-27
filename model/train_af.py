import json
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model
from sklearn.metrics import roc_auc_score, roc_curve

from af_common import DATA, MODEL_PATH, EVAL_DIR, WIN, record_probs
from cnn_se_rr_model import res_se_block

for gpu in tf.config.list_physical_devices("GPU"):
    tf.config.experimental.set_memory_growth(gpu, True)
tf.random.set_seed(42)
np.random.seed(42)

EPOCHS, BATCH, PATIENCE = 40, 64, 8


def build_model():
    inp = layers.Input(shape=(WIN, 1), name="ecg")
    x = layers.GaussianNoise(0.05)(inp)  # active only during training
    x = layers.Conv1D(16, 15, strides=2, padding="same")(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    for f in (16, 32, 32, 64, 64):
        x = res_se_block(x, f, kernel=7)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(1, activation="sigmoid")(x)
    return Model(inp, out, name="af_cnn_se")


class RecordAUC(tf.keras.callbacks.Callback):
    def __init__(self, X, rec_idx, y_rec):
        super().__init__()
        self.X, self.rec_idx, self.y_rec = X, rec_idx, y_rec
        self.best, self.wait, self.best_w = -1.0, 0, None

    def on_epoch_end(self, epoch, logs=None):
        p = self.model.predict(self.X, batch_size=128, verbose=0).ravel()
        auc = roc_auc_score(self.y_rec, record_probs(p, self.rec_idx, len(self.y_rec)))
        logs["val_record_auc"] = auc
        print(f"  val_record_auc={auc:.4f}")
        if auc > self.best:
            self.best, self.wait = auc, 0
            self.best_w = self.model.get_weights()
        else:
            self.wait += 1
            if self.wait >= PATIENCE:
                self.model.stop_training = True

    def on_train_end(self, logs=None):
        if self.best_w is not None:
            self.model.set_weights(self.best_w)


def main():
    # Only train and validation are loaded. The test split is never touched here.
    Xtr = np.load(DATA / "X_train.npy")
    ytr = np.load(DATA / "ywin_train.npy")
    Xva = np.load(DATA / "X_val.npy")
    rva = np.load(DATA / "recidx_val.npy")
    yva = np.load(DATA / "yrec_val.npy")

    n0, n1 = int((ytr == 0).sum()), int((ytr == 1).sum())
    cw = {0: 1.0, 1: float(np.sqrt(n0 / n1))}
    print(f"train windows N={n0} AF={n1}  class_weight={cw}")

    model = build_model()
    model.summary()
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="binary_crossentropy")
    cb = RecordAUC(Xva, rva, yva)
    lr = tf.keras.callbacks.ReduceLROnPlateau(
        monitor="loss", factor=0.5, patience=3, min_lr=1e-5
    )
    model.fit(
        Xtr,
        ytr,
        batch_size=BATCH,
        epochs=EPOCHS,
        class_weight=cw,
        callbacks=[cb, lr],
        verbose=2,
    )

    # choose the decision threshold on validation records (Youden's J)
    p = model.predict(Xva, batch_size=128, verbose=0).ravel()
    rp = record_probs(p, rva, len(yva))
    fpr, tpr, thr = roc_curve(yva, rp)
    t = float(thr[np.argmax(tpr - fpr)])
    print(f"best val record AUC {cb.best:.4f}  threshold {t:.3f}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    model.save(MODEL_PATH)
    (EVAL_DIR / "threshold.json").write_text(
        json.dumps({"threshold": t, "val_record_auc": float(cb.best)})
    )
    print("saved:", MODEL_PATH)


if __name__ == "__main__":
    main()
