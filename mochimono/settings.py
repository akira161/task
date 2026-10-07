"""設定画面: 通知時刻・デフォルトの持ち物・日付ごとの特別な持ち物。"""
from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, ttk

from . import core


class SettingsWindow:
    def __init__(self, master: tk.Misc | None = None):
        self.root = tk.Toplevel(master) if master else tk.Tk()
        self.root.title("持ち物チェック 設定")
        self.cfg = core.load_config()
        self.times: list[str] = list(self.cfg["times"])
        self.defaults: list[str] = list(self.cfg["default_items"])
        self.special: list[dict] = [dict(e) for e in self.cfg["special"]]

        pad = {"padx": 8, "pady": 4}
        nb = ttk.Notebook(self.root)
        nb.pack(fill="both", expand=True, **pad)

        # --- 時刻 ---
        f = ttk.Frame(nb)
        nb.add(f, text="通知時刻")
        self.time_list = tk.Listbox(f, height=6)
        self.time_list.pack(side="left", fill="both", expand=True, **pad)
        side = ttk.Frame(f)
        side.pack(side="left", **pad)
        self.time_entry = ttk.Entry(side, width=8)
        self.time_entry.pack()
        ttk.Label(side, text="例: 07:30").pack()
        ttk.Button(side, text="追加", command=self.add_time).pack(fill="x", pady=2)
        ttk.Button(side, text="選択を削除", command=self.del_time).pack(fill="x")

        # --- デフォルト ---
        f = ttk.Frame(nb)
        nb.add(f, text="いつもの持ち物")
        self.def_list = tk.Listbox(f, height=10)
        self.def_list.pack(side="left", fill="both", expand=True, **pad)
        side = ttk.Frame(f)
        side.pack(side="left", **pad)
        self.def_entry = ttk.Entry(side, width=16)
        self.def_entry.pack()
        self.def_entry.bind("<Return>", lambda e: self.add_default())
        ttk.Button(side, text="追加", command=self.add_default).pack(fill="x", pady=2)
        ttk.Button(side, text="選択を削除", command=self.del_default).pack(fill="x")

        # --- 特別 ---
        f = ttk.Frame(nb)
        nb.add(f, text="特別な持ち物(日付指定)")
        self.sp_list = tk.Listbox(f, height=8, width=50)
        self.sp_list.pack(fill="both", expand=True, **pad)
        self.sp_list.bind("<<ListboxSelect>>", self.load_special)
        form = ttk.Frame(f)
        form.pack(fill="x", **pad)
        ttk.Label(form, text="日付 (YYYY-MM-DD)").grid(row=0, column=0, sticky="w")
        self.sp_date = ttk.Entry(form, width=14)
        self.sp_date.grid(row=0, column=1, sticky="w", padx=4)
        ttk.Label(form, text="持ち物 (カンマ区切り)").grid(row=1, column=0, sticky="w")
        self.sp_items = ttk.Entry(form, width=36)
        self.sp_items.grid(row=1, column=1, sticky="we", padx=4)
        btns = ttk.Frame(f)
        btns.pack(**pad)
        ttk.Button(btns, text="追加 / 更新", command=self.save_special).pack(side="left", padx=2)
        ttk.Button(btns, text="選択を削除", command=self.del_special).pack(side="left", padx=2)

        bottom = ttk.Frame(self.root)
        bottom.pack(fill="x", **pad)
        ttk.Button(bottom, text="保存して閉じる", command=self.save).pack(side="right")
        ttk.Button(bottom, text="キャンセル", command=self.root.destroy).pack(side="right", padx=4)

        self.refresh()

    # ---- 表示更新 ----
    def refresh(self) -> None:
        for lb, rows in (
            (self.time_list, self.times),
            (self.def_list, self.defaults),
        ):
            lb.delete(0, "end")
            for r in rows:
                lb.insert("end", r)
        self.sp_list.delete(0, "end")
        for e in self.special:
            self.sp_list.insert("end", f"{e['date']}: {', '.join(e['items'])}")

    @staticmethod
    def _sel(lb: tk.Listbox) -> int | None:
        s = lb.curselection()
        return s[0] if s else None

    # ---- 時刻 ----
    def add_time(self) -> None:
        try:
            t = core.normalize_time(self.time_entry.get())
        except ValueError as e:
            return messagebox.showerror("入力エラー", str(e), parent=self.root)
        if t not in self.times:
            self.times.append(t)
            self.times.sort()
        self.time_entry.delete(0, "end")
        self.refresh()

    def del_time(self) -> None:
        i = self._sel(self.time_list)
        if i is not None:
            del self.times[i]
            self.refresh()

    # ---- デフォルト ----
    def add_default(self) -> None:
        for it in core.split_items(self.def_entry.get()):
            if it not in self.defaults:
                self.defaults.append(it)
        self.def_entry.delete(0, "end")
        self.refresh()

    def del_default(self) -> None:
        i = self._sel(self.def_list)
        if i is not None:
            del self.defaults[i]
            self.refresh()

    # ---- 特別 ----
    def save_special(self) -> None:
        try:
            d = core.parse_date(self.sp_date.get()).isoformat()
        except ValueError as e:
            return messagebox.showerror("入力エラー", str(e), parent=self.root)
        items = core.split_items(self.sp_items.get())
        if not items:
            return messagebox.showerror("入力エラー", "持ち物を入力してください", parent=self.root)
        self.special = [e for e in self.special if e["date"] != d]
        self.special.append({"date": d, "items": items})
        self.special.sort(key=lambda e: e["date"])
        self.refresh()

    def load_special(self, _evt=None) -> None:
        i = self._sel(self.sp_list)
        if i is None:
            return
        e = self.special[i]
        self.sp_date.delete(0, "end")
        self.sp_date.insert(0, e["date"])
        self.sp_items.delete(0, "end")
        self.sp_items.insert(0, ", ".join(e["items"]))

    def del_special(self) -> None:
        i = self._sel(self.sp_list)
        if i is not None:
            del self.special[i]
            self.refresh()

    # ---- 保存 ----
    def save(self) -> None:
        if not self.times:
            return messagebox.showerror("入力エラー", "通知時刻を1つ以上設定してください", parent=self.root)
        core.save_config(
            {"times": self.times, "default_items": self.defaults, "special": self.special}
        )
        messagebox.showinfo("保存", "保存しました。常駐中のアプリには自動で反映されます。", parent=self.root)
        self.root.destroy()


def main() -> None:
    SettingsWindow().root.mainloop()
