#!/bin/bash
# Commit new management command and media files
cd "$(dirname "$0")"
echo "Adding files to git..."
git add project_k/management/commands/add_product_from_image.py PRODUCT_MEDIA_README.md media/products/images/patta.jpg media/products/videos/patta_video.mp4
echo "Commit message: Add product management command and example media"
git commit -m "Add product management command and example media"
echo "Pushing to origin..."
git push
echo "Done."
