"""設定の読み書きと「今日のリスト」の計算(GUIに依存しない部分)。"""
from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, time, timedelta
from pathlib import Path

TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")
# 起動が予定時刻に遅れても、この時間内なら当日分として通知する
GRACE = timedelta(minutes=60)

DEFAULT_CONFIG = {
    "times": ["07:30"],
    "default_items": ["財布", "スマホ", "鍵", "定期券"],
    "special": [],  # [{"date": "2026-10-10", "items": ["体操服"]}]
}


def data_dir() -> Path:
    env = os.environ.get("MOCHIMONO_DIR")
    return Path(env) if env else Path.home() / ".mochimono"


def config_path() -> Path:
    return data_dir() / "config.json"


def state_path() -> Path:
    return data_dir() / "state.json"


def parse_time(text: str) -> time:
    m = TIME_RE.match(text.strip())
    if not m:
        raise ValueError(f"時刻は HH:MM 形式で入力してください: {text!r}")
    return time(int(m.group(1)), int(m.group(2)))


def normalize_time(text: str) -> str:
    t = parse_time(text)
    return f"{t.hour:02d}:{t.minute:02d}"


def parse_date(text: str) -> date:
    try:
        return datetime.strptime(text.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"日付は YYYY-MM-DD 形式で入力してください: {text!r}") from None


def split_items(text: str) -> list[str]:
    """改行・カンマ区切りの文字列を項目リストにする(空・重複は除去)。"""
    out: list[str] = []
    for part in re.split(r"[,、\n]", text):
        part = part.strip()
        if part and part not in out:
            out.append(part)
    return out


def load_config() -> dict:
    p = config_path()
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if p.exists():
        try:
            loaded = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            loaded = {}
        for key in cfg:
            if key in loaded:
                cfg[key] = loaded[key]
    return cfg


def save_config(cfg: dict) -> None:
    p = config_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(p)


def items_for(cfg: dict, day: date) -> list[str]:
    """その日に確認する項目 = デフォルト + その日付の特別な持ち物。"""
    items = list(cfg.get("default_items", []))
    for entry in cfg.get("special", []):
        if entry.get("date") == day.isoformat():
            for it in entry.get("items", []):
                if it not in items:
                    items.append(it)
    return items


def load_state() -> dict:
    try:
        return json.loads(state_path().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state: dict) -> None:
    p = state_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state), encoding="utf-8")


def due_times(cfg: dict, now: datetime, fired: list[str]) -> list[str]:
    """今この瞬間に通知すべき時刻(未通知で、予定時刻を過ぎ、猶予内)。"""
    due = []
    for t in sorted(set(cfg.get("times", []))):
        key = f"{now.date().isoformat()} {t}"
        if key in fired:
            continue
        try:
            scheduled = datetime.combine(now.date(), parse_time(t))
        except ValueError:
            continue
        if scheduled <= now <= scheduled + GRACE:
            due.append(t)
    return due


def prune_fired(fired: list[str], today: date) -> list[str]:
    return [k for k in fired if k.startswith(today.isoformat())]
