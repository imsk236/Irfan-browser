"""PyInstaller entry point for the FastAPI backend."""
import sys
import os

# When frozen, add the directory containing this file to sys.path so that
# 'import src.main' resolves correctly.
if getattr(sys, "frozen", False):
    bundle_dir = sys._MEIPASS
    sys.path.insert(0, bundle_dir)

from src.main import main

if __name__ == "__main__":
    main()
