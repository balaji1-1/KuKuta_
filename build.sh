#!/bin/bash
set -e

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing Node dependencies..."
cd kukuta.com
npm install

echo "Building React frontend..."
npm run build

echo "Running database migrations..."
cd ..
python manage.py migrate

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Build complete!"
