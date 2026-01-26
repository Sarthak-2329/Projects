import tensorflow as tf
from tensorflow import keras
import numpy as np
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

# --- Configuration for Reproducibility and Efficiency ---
# Set GPU/CPU configuration (optional)
# tf.config.experimental.set_memory_growth(tf.config.experimental.list_physical_devices('GPU')[0], True) 
tf.random.set_seed(42)

# Load Fashion-MNIST dataset
(x_train, y_train), (x_test, y_test) = keras.datasets.fashion_mnist.load_data()

# Preprocess data
x_train = x_train.astype('float32') / 255.0
x_test = x_test.astype('float32') / 255.0

# Reshape for CNN (add channel dimension)
x_train = x_train.reshape(-1, 28, 28, 1)
x_test = x_test.reshape(-1, 28, 28, 1)

# --- Data Augmentation ---
# Create an ImageDataGenerator for on-the-fly augmentation during training
datagen = ImageDataGenerator(
    rotation_range=8,          # Rotate images by up to 8 degrees
    zoom_range=0.08,           # Zoom in/out by up to 8%
    width_shift_range=0.1,     # Shift images horizontally by up to 10%
    height_shift_range=0.1,    # Shift images vertically by up to 10%
    horizontal_flip=True,      # Randomly flip images
    validation_split=0.2       # Use 20% of training data for validation
)

# Fit the data generator on the training data
datagen.fit(x_train)

# --- Optimized CNN Model Architecture (with Batch Normalization) ---
model = keras.Sequential([
    # Block 1
    keras.layers.Conv2D(32, (3, 3), padding='same', use_bias=False, input_shape=(28, 28, 1)),
    keras.layers.BatchNormalization(), # Add Batch Normalization
    keras.layers.ReLU(),
    keras.layers.MaxPooling2D((2, 2)),
    keras.layers.Dropout(0.2), # Small dropout after pooling for early regularization

    # Block 2 (Increased complexity)
    keras.layers.Conv2D(64, (3, 3), padding='same', use_bias=False),
    keras.layers.BatchNormalization(), # Add Batch Normalization
    keras.layers.ReLU(),
    keras.layers.MaxPooling2D((2, 2)),
    keras.layers.Dropout(0.2),

    # Block 3 (Further increased capacity)
    keras.layers.Conv2D(128, (3, 3), padding='same', use_bias=False),
    keras.layers.BatchNormalization(),
    keras.layers.ReLU(),
    
    # Classifier
    keras.layers.Flatten(),
    keras.layers.Dense(256, use_bias=False), # Increased dense layer capacity (was 64)
    keras.layers.BatchNormalization(),
    keras.layers.ReLU(),
    keras.layers.Dropout(0.5),
    keras.layers.Dense(10, activation='softmax')
])

# --- Callbacks for Enhanced Training Stability and Convergence ---
callbacks = [
    # Stop training if validation accuracy doesn't improve for 5 epochs
    EarlyStopping(monitor='val_accuracy', patience=5, restore_best_weights=True), 
    # Reduce learning rate when val_loss plateaus
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=0.00001, verbose=1)
]


# Compile model (using a slightly lower initial learning rate for better stability)
optimizer = keras.optimizers.Adam(learning_rate=0.001)

model.compile(
    optimizer=optimizer,
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

# Train model using the augmented data flow
print("Starting training with Data Augmentation and Callbacks...")
history = model.fit(
    datagen.flow(x_train, y_train, batch_size=128, subset='training'), # Augmented training data
    epochs=25, # Increased epochs (EarlyStopping will prevent overfitting)
    validation_data=datagen.flow(x_train, y_train, batch_size=128, subset='validation'), # Augmented validation data
    callbacks=callbacks,
    verbose=1
)

# Evaluate model
test_loss, test_acc = model.evaluate(x_test, y_test, verbose=0)
print(f"Test accuracy: {test_acc:.4f}")

# Save model
model.save('fashion_mnist_model.h5')
print("Optimized model saved successfully!")
