"""Raw data acquisition with a local snapshot layer.

Baseball-Reference etiquette (see fungo docs): the WAR daily files are the only
B-R endpoints this pipeline touches — two requests total, ever. Both layers of
caching mean rebuilds make zero network requests:

  1. fungo's opt-in bbref response cache (immutable pages, no TTL)
  2. this module's JSON snapshots under build/raw/

Everything else comes from the Lahman database, which is a bulk download by
design (fungo caches it independently).

To force a refresh (e.g. a new Lahman release or updated WAR files), delete the
relevant file under build/raw/ — never loop refreshes against B-R.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

RAW_DIR = Path(__file__).resolve().parent.parent / "build" / "raw"

Rows = list[dict[str, Any]]


def _snapshot(name: str, loader: Callable[[], Rows]) -> Rows:
    path = RAW_DIR / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    rows = loader()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows))
    return rows


def load_war(kind: str) -> Rows:
    """B-R WAR daily file ("bat" or "pitch"), snapshotted."""

    def fetch() -> Rows:
        from fungo import bbref
        from fungo.bbref import war

        bbref.enable_cache()
        return war.get_war_daily(kind)

    return _snapshot(f"war_{kind}", fetch)


def load_lahman(table: str) -> Rows:
    """Lahman table by name, snapshotted."""

    def fetch() -> Rows:
        from fungo import lahman

        return lahman.get_table(table)

    return _snapshot(f"lahman_{table}", fetch)
