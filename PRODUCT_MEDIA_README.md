Product media and management command
=================================

Summary
-------
This project includes a management command to create a `Product` record and attach local image/video files.

Files
-----
- `project_k/management/commands/add_product_from_image.py` — management command. Usage:

  ```bash
  python manage.py add_product_from_image --image media/products/images/patta.jpg --video media/products/videos/patta_video.mp4
  ```

- Media locations:
  - Images: `media/products/images/`
  - Videos: `media/products/videos/`

Notes
-----
- The command accepts optional flags: `--name`, `--price`, `--description`, `--category`, `--quantity`, `--seller`, `--bird_type`, `--video`, `--video_title`, `--video_description`.
- After running the command, the product will be available via the API at `/api/products/` (when the Django server is running).

Committing
---------
- This environment does not have `git` available, so please run the following locally to commit media and the new command:

  ```bash
  git add project_k/management/commands/add_product_from_image.py media/products/images/patta.jpg media/products/videos/patta_video.mp4 PRODUCT_MEDIA_README.md
  git commit -m "Add management command and example media for product creation"
  git push
  ```
