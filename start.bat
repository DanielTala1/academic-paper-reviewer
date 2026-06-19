@echo off
echo Starting Academic Paper Reviewer...
python -m pip install -r requirements.txt -q
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
