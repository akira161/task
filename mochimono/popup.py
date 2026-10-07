"""全項目にチェックが入るまで閉じられないポップアップ。"""
from __future__ import annotations

import tkinter as tk
from tkinter import font as tkfont


class ChecklistPopup:
    def __init__(self, master: tk.Misc, items: list[str], title: str = "持ち物チェック"):
        self.items = items
        self.win = tk.Toplevel(master)
        self.win.title(title)
        self.win.attributes("-topmost", True)
        self.win.resizable(False, False)
        # ×ボタン・Alt+F4 等では閉じさせない
        self.win.protocol("WM_DELETE_WINDOW", lambda: None)
        self.win.bind("<Escape>", lambda e: "break")

        big = tkfont.Font(size=20, weight="bold")
        item_font = tkfont.Font(size=18)
        tk.Label(self.win, text="持ち物は全部ありますか?", font=big).pack(padx=40, pady=(24, 8))
        tk.Label(self.win, text="すべてにチェックを入れると閉じられます").pack()

        frame = tk.Frame(self.win)
        frame.pack(padx=40, pady=16, anchor="w")
        self.vars: list[tk.BooleanVar] = []
        for it in items:
            var = tk.BooleanVar(value=False)
            var.trace_add("write", lambda *_: self._update())
            tk.Checkbutton(frame, text=it, variable=var, font=item_font, anchor="w").pack(
                fill="x", pady=2
            )
            self.vars.append(var)

        self.status = tk.Label(self.win, text="")
        self.status.pack()
        self.button = tk.Button(
            self.win, text="確認OK", font=big, state="disabled", command=self.win.destroy
        )
        self.button.pack(padx=40, pady=(8, 24), fill="x")
        self._update()

        self._center()
        self.win.grab_set()
        self.win.focus_force()
        self._keep_on_top()

    def _update(self) -> None:
        remaining = sum(not v.get() for v in self.vars)
        self.button.config(state="normal" if remaining == 0 else "disabled")
        self.status.config(text="全部そろっています" if remaining == 0 else f"あと {remaining} 個")

    def _center(self) -> None:
        self.win.update_idletasks()
        w, h = self.win.winfo_reqwidth(), self.win.winfo_reqheight()
        x = (self.win.winfo_screenwidth() - w) // 2
        y = (self.win.winfo_screenheight() - h) // 3
        self.win.geometry(f"+{x}+{y}")

    def _keep_on_top(self) -> None:
        # 他のウィンドウに隠されないよう定期的に前面へ
        if self.win.winfo_exists():
            self.win.lift()
            self.win.after(1500, self._keep_on_top)

    def all_checked(self) -> bool:
        return all(v.get() for v in self.vars)
