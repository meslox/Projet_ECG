import json
import numpy as np
from scipy.io import loadmat
from scipy.signal import butter, filtfilt
from sklearn.model_selection import train_test_split

from af_common import SRC, DATA, FS, WIN

TRAIN_STRIDE = 5 * FS
SEED = 42
B, A = butter(3, [0.5 / (FS / 2), 40.0 / (FS / 2)], btype="band")


def load_labels():
    labels = {}
    for line in (SRC / "REFERENCE.csv").read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        rid, lab = line.split(",")
        if lab in ("N", "A"):  # Other and Noisy are dropped
            labels[rid] = 1 if lab == "A" else 0
    return labels


def zscore(w):
    return (w - w.mean()) / (w.std() + 1e-8)


def windows(rid, stride):
    sig = loadmat(SRC / f"{rid}.mat")["val"].ravel().astype(np.float64) / 1000.0
    sig = filtfilt(B, A, sig)
    if len(sig) < WIN:
        sig = np.pad(sig, (0, WIN - len(sig)), mode="wrap")
    starts = range(0, len(sig) - WIN + 1, stride)
    return np.stack([zscore(sig[s : s + WIN]) for s in starts]).astype(np.float32)


def build(rids, labels, stride):
    X, ywin, ridx = [], [], []
    for k, rid in enumerate(rids):
        w = windows(rid, stride)
        X.append(w)
        ywin.append(np.full(len(w), labels[rid], dtype=np.int64))
        ridx.append(np.full(len(w), k, dtype=np.int64))
    return (
        np.concatenate(X)[..., None],
        np.concatenate(ywin),
        np.concatenate(ridx),
        np.array([labels[r] for r in rids]),
    )


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    labels = load_labels()
    ids = sorted(labels)
    y = np.array([labels[i] for i in ids])
    print(f"records: {len(ids)}  N={int((y == 0).sum())}  AF={int((y == 1).sum())}")

    trval, test = train_test_split(ids, test_size=0.15, stratify=y, random_state=SEED)
    ytv = np.array([labels[i] for i in trval])
    train, val = train_test_split(
        trval, test_size=0.1765, stratify=ytv, random_state=SEED
    )
    splits = {"train": (train, TRAIN_STRIDE), "val": (val, WIN), "test": (test, WIN)}

    assert (
        not (set(train) & set(val))
        and not (set(train) & set(test))
        and not (set(val) & set(test))
    ), "RECORD LEAKAGE"
    for name, (rids, stride) in splits.items():
        X, ywin, ridx, yrec = build(rids, labels, stride)
        np.save(DATA / f"X_{name}.npy", X)
        np.save(DATA / f"ywin_{name}.npy", ywin)
        np.save(DATA / f"recidx_{name}.npy", ridx)
        np.save(DATA / f"yrec_{name}.npy", yrec)
        print(
            f"{name}: records={len(rids)} (AF={int(yrec.sum())}) "
            f"windows={len(X)} X={X.shape}"
        )
    (DATA / "splits.json").write_text(json.dumps({k: v[0] for k, v in splits.items()}))
    print("saved to", DATA)


if __name__ == "__main__":
    main()
