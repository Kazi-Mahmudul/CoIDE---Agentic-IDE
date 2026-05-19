"""
Centralized configuration for the Coide backend.
All modules import WORKSPACE_DIR from here to ensure consistency.
"""

import os

# The workspace directory is always at the project root level: Coide/workspace
# Using the backend directory's parent ensures consistency regardless of which
# submodule imports this (e.g. chat/tools.py vs tools.py).
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)

_DEFAULT_WORKSPACE_DIR = os.path.normpath(os.path.join(_PROJECT_ROOT, "workspace"))

# In serverless (Vercel), only /tmp is writable.
if os.environ.get("VERCEL"):
    _DEFAULT_WORKSPACE_DIR = "/tmp/coide-workspace"

WORKSPACE_DIR = os.path.normpath(
    os.environ.get("COIDE_WORKSPACE_DIR", _DEFAULT_WORKSPACE_DIR)
)
