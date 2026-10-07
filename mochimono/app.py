"""常駐プロセス: 設定時刻になったらポップアップを出す。"""
from __future__ import annotations

import sys
import tkinter as tk
from datetime import datetime

from . import core
from .popup import ChecklistPopup

POLL_MS = 15_000


class Daemon:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.withdraw()
        self.busy = False
        self.fired: list[str] = core.load_state().get("fired", [])

    def tick(self) -> None:
        now = datetime.now()
        self.fired = core.prune_fired(self.fired, now.date())
        if not self.busy:
            cfg = core.load_config()  # 毎回読むので設定変更が即反映される
            due = core.due_times(cfg, now, self.fired)
            if due:
                for t in due:
                    self.fired.append(f"{now.date().isoformat()} {t}")
                core.save_state({"fired": self.fired})
                items = core.items_for(cfg, now.date())
                if items:
                    self.notify(items)
        self.root.after(POLL_MS, self.tick)

    def notify(self, items: list[str]) -> None:
        self.busy = True
        popup = ChecklistPopup(self.root, items)
        popup.win.bind("<Destroy>", lambda e: self._done(e, popup), add="+")

    def _done(self, event, popup) -> None:
        if event.widget is popup.win:
            self.busy = False

    def run(self) -> None:
        self.root.after(500, self.tick)
        self.root.mainloop()


def show_now() -> None:
    """設定を無視せず、今日のリストをすぐ表示(動作確認用)。"""
    root = tk.Tk()
    root.withdraw()
    items = core.items_for(core.load_config(), datetime.now().date())
    popup = ChecklistPopup(root, items or ["(今日の持ち物が未設定です)"])
    popup.win.bind("<Destroy>", lambda e: root.quit() if e.widget is popup.win else None, add="+")
    root.mainloop()


def main(argv: list[str] | None = None) -> None:
    args = sys.argv[1:] if argv is None else argv
    cmd = args[0] if args else "run"
    if cmd == "run":
        Daemon().run()
    elif cmd == "settings":
        from .settings import main as settings_main

        settings_main()
    elif cmd == "test":
        show_now()
    else:
        print("使い方: python -m mochimono [run|settings|test]")
        sys.exit(2)
