#!/usr/bin/env bash
# Render deploy start script
cd "$(dirname "$0")"
exec gunicorn -b 0.0.0.0:${PORT:-5001} -w 4 app:app
