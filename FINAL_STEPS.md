Final steps to finish and verify
=================================

1. Commit & push changes (run one of these locally):

   Windows (double-click `commit_and_push.bat` or run in PowerShell):

   ```powershell
   .\commit_and_push.bat
   ```

   macOS / Linux:

   ```bash
   chmod +x commit_and_push.sh
   ./commit_and_push.sh
   ```

2. If you want to browse the frontend locally:

   - Frontend (Vite) is running at: http://127.0.0.1:5184/static/
   - Backend (Django) is running at: http://127.0.0.1:8000/

3. To verify product via API:

   ```bash
   curl http://127.0.0.1:8000/api/products/ | jq .
   ```

4. To stop servers, find their terminals and press Ctrl+C. Restart Django with:

   ```bash
   python manage.py runserver 127.0.0.1:8000
   ```

5. If you want me to implement additional features (frontend product card, tests, CI), tell me which and I'll prepare the changes.
