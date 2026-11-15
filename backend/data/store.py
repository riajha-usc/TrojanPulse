"""Read the generated data files. Files are re-read on every call, so editing one changes the next answer."""

import json
from pathlib import Path
from typing import Any, Optional

GENERATED_DIR = Path(__file__).parent / "generated"


def load(name: str, folder: Optional[Path] = None) -> Any:
    path = (folder or GENERATED_DIR) / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing. Run: python -m data.generate")
    return json.loads(path.read_text(encoding="utf-8"))


def version(name: str, folder: Optional[Path] = None) -> tuple:
    """Changes whenever the file changes. Used to know when a trained model is out of date."""
    path = (folder or GENERATED_DIR) / f"{name}.json"
    return (str(path), path.stat().st_mtime_ns)


def save(name: str, rows: Any, folder: Optional[Path] = None) -> None:
    folder = folder or GENERATED_DIR
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{name}.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
