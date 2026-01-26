# app.py
from flask import Flask, request, jsonify
import tensorflow as tf
from tensorflow import keras
import numpy as np
from PIL import Image
import io
import base64

app = Flask(__name__)

# Load the pre-trained model
model = keras.models.load_model('fashion_mnist_model.h5')

# Fashion-MNIST class labels
CLASS_LABELS = [
    'T-shirt/top', 'Trouser', 'Pullover', 'Dress', 'Coat',
    'Sandal', 'Shirt', 'Sneaker', 'Bag', 'Ankle boot'
]

def preprocess_image(image_data):
    """Preprocess image for model prediction"""
    # Convert to grayscale and resize to 28x28
    img = Image.open(io.BytesIO(image_data)).convert('L')
    img = img.resize((28, 28))
    
    # Convert to numpy array and normalize
    img_array = np.array(img).astype('float32') / 255.0
    
    # Reshape to match model input shape
    img_array = img_array.reshape(1, 28, 28, 1)
    
    return img_array

@app.route('/', methods=['GET'])
def home():
    """Health check endpoint"""
    return jsonify({
        'status': 'running',
        'message': 'Fashion-MNIST Classification API',
        'version': '1.0'
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Prediction endpoint - accepts image and returns classification"""
    try:
        # Check if image file is in request
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        # Read image file
        image_file = request.files['image']
        image_data = image_file.read()
        
        # Preprocess image
        processed_image = preprocess_image(image_data)
        
        # Make prediction
        predictions = model.predict(processed_image, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][predicted_class])
        
        # Prepare response with top 3 predictions
        top_3_indices = np.argsort(predictions[0])[-3:][::-1]
        top_3_predictions = [
            {
                'class': CLASS_LABELS[idx],
                'class_id': int(idx),
                'confidence': float(predictions[0][idx])
            }
            for idx in top_3_indices
        ]
        
        return jsonify({
            'success': True,
            'prediction': CLASS_LABELS[predicted_class],
            'class_id': predicted_class,
            'confidence': confidence,
            'top_3': top_3_predictions
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/predict/base64', methods=['POST'])
def predict_base64():
    """Alternative endpoint accepting base64 encoded images"""
    try:
        data = request.get_json()
        
        if 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Decode base64 image
        image_data = base64.b64decode(data['image'])
        
        # Preprocess and predict
        processed_image = preprocess_image(image_data)
        predictions = model.predict(processed_image, verbose=0)
        predicted_class = int(np.argmax(predictions[0]))
        confidence = float(predictions[0][predicted_class])
        
        return jsonify({
            'success': True,
            'prediction': CLASS_LABELS[predicted_class],
            'class_id': predicted_class,
            'confidence': confidence
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health():
    """Detailed health check"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'endpoints': ['/predict', '/predict/base64', '/health']
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
