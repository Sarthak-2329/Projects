# test_api.py
import requests
import json
from tensorflow import keras
import numpy as np
from PIL import Image

# Load a test image from Fashion-MNIST
(x_train, y_train), (x_test, y_test) = keras.datasets.fashion_mnist.load_data()

# Save a test image
test_image = x_test[0]
img = Image.fromarray(test_image)
img.save('test_image.png')

# Test the API
url = 'http://localhost:5000/predict'

with open('test_image.png', 'rb') as f:
    files = {'image': f}
    response = requests.post(url, files=files)
    print("Response:", json.dumps(response.json(), indent=2))
