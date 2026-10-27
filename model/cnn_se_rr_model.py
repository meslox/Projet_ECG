import tensorflow as tf
from tensorflow.keras import layers, Model

NUM_CLASSES = 4
CLASS_NAMES = ["N", "S", "V", "F"]


def se_block(x, ratio=4):
    ch = x.shape[-1]
    s = layers.GlobalAveragePooling1D()(x)
    s = layers.Dense(max(ch // ratio, 4), activation="relu")(s)
    s = layers.Dense(ch, activation="sigmoid")(s)
    s = layers.Reshape((1, ch))(s)
    return layers.Multiply()([x, s])


def res_se_block(x, filters, kernel=5, pool=True):
    shortcut = x
    if x.shape[-1] != filters:
        shortcut = layers.Conv1D(filters, 1, padding="same")(x)
    y = layers.Conv1D(filters, kernel, padding="same")(x)
    y = layers.BatchNormalization()(y)
    y = layers.ReLU()(y)
    y = layers.Conv1D(filters, kernel, padding="same")(y)
    y = layers.BatchNormalization()(y)
    y = se_block(y)
    y = layers.Add()([shortcut, y])
    y = layers.ReLU()(y)
    if pool:
        y = layers.MaxPooling1D(2)(y)
    return y


def build_model():
    beat_in = layers.Input(shape=(200, 1), name="beat")
    rr_in = layers.Input(shape=(4,), name="rr")

    x = layers.Conv1D(16, 7, padding="same")(beat_in)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = res_se_block(x, 16)
    x = res_se_block(x, 32)
    x = res_se_block(x, 64)
    x = layers.GlobalAveragePooling1D()(x)

    r = layers.Dense(16, activation="relu")(rr_in)

    z = layers.Concatenate()([x, r])
    z = layers.Dense(32, activation="relu")(z)
    z = layers.Dropout(0.3)(z)
    out = layers.Dense(NUM_CLASSES, activation="softmax", name="cls")(z)
    return Model([beat_in, rr_in], out, name="cnn_se_rr")


def make_focal_loss(alpha, gamma=2.0):
    alpha_t = tf.constant(alpha, dtype=tf.float32)

    def loss(y_true, y_pred):
        y_true = tf.cast(tf.reshape(y_true, [-1]), tf.int32)
        onehot = tf.one_hot(y_true, NUM_CLASSES)
        p = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        ce = -onehot * tf.math.log(p)
        w = alpha_t * tf.pow(1.0 - p, gamma)
        return tf.reduce_mean(tf.reduce_sum(w * ce, axis=-1))

    return loss


if __name__ == "__main__":
    build_model().summary()
