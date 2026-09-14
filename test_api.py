import urllib.request
import json

# Test static file
try:
    with urllib.request.urlopen('http://127.0.0.1:8000/static/index.html') as response:
        data = response.read().decode()
        print(f"✅ Static index.html accessible: {'React app' if 'Kukuta' in data else 'Other'}")
except Exception as e:
    print(f"❌ Static file Error: {e}")

# Test our test API
try:
    with urllib.request.urlopen('http://127.0.0.1:8000/testapi/') as response:
        data = json.loads(response.read().decode())
        print(f"✅ Test API Response: {data}")
except Exception as e:
    print(f"❌ Test API Error: {e}")
    # Try to get the raw response
    try:
        with urllib.request.urlopen('http://127.0.0.1:8000/testapi/') as response:
            raw_data = response.read().decode()
            print(f"Raw response type: {'HTML' if '<!DOCTYPE' in raw_data else 'Other'}")
            print(f"Is it the React app? {'Yes' if 'Kukuta' in raw_data else 'No'}")
    except Exception as e2:
        print(f"❌ Even raw response failed: {e2}")