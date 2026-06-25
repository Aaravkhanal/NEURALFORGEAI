import os
import requests

url = "https://integrate.api.nvidia.com/v1/chat/completions"
api_key = os.environ.get("NVIDIA_API_KEY", "")
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}
data = {
    "model": "meta/llama-3.1-70b-instruct",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.1,
    "max_tokens": 100
}

try:
    response = requests.post(url, headers=headers, json=data, timeout=10)
    print("Status:", response.status_code)
    print("Body:", response.text)
except Exception as e:
    print("Error:", e)
