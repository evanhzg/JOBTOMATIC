"""In-process event bus. Modules publish; the WebSocket endpoint fans out to browsers."""
from __future__ import annotations

import asyncio
import json
from typing import Any, Set

_subscribers: Set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=500)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


def publish(event_type: str, data: Any = None) -> None:
    msg = json.dumps({"type": event_type, "data": data}, ensure_ascii=False, default=str)
    for q in list(_subscribers):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            pass
