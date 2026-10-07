import os
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["MOCHIMONO_DIR"] = tempfile.mkdtemp()

from mochimono import core  # noqa: E402


class CoreTests(unittest.TestCase):
    def test_items_for_merges_special_on_date_only(self):
        cfg = {
            "default_items": ["財布", "鍵"],
            "special": [{"date": "2026-10-10", "items": ["体操服", "鍵"]}],
        }
        self.assertEqual(core.items_for(cfg, date(2026, 10, 10)), ["財布", "鍵", "体操服"])
        self.assertEqual(core.items_for(cfg, date(2026, 10, 11)), ["財布", "鍵"])

    def test_due_times(self):
        cfg = {"times": ["07:30", "18:00"]}
        d = "2026-10-07"
        self.assertEqual(core.due_times(cfg, datetime(2026, 10, 7, 7, 29), []), [])
        self.assertEqual(core.due_times(cfg, datetime(2026, 10, 7, 7, 30), []), ["07:30"])
        self.assertEqual(core.due_times(cfg, datetime(2026, 10, 7, 7, 30), [f"{d} 07:30"]), [])
        # 猶予(60分)を過ぎたら出さない
        self.assertEqual(core.due_times(cfg, datetime(2026, 10, 7, 8, 31), []), [])

    def test_split_items(self):
        self.assertEqual(core.split_items("a, b、c\n a ,,"), ["a", "b", "c"])

    def test_time_validation(self):
        self.assertEqual(core.normalize_time("7:05"), "07:05")
        for bad in ("25:00", "7", "abc"):
            with self.assertRaises(ValueError):
                core.normalize_time(bad)

    def test_config_roundtrip_and_defaults(self):
        self.assertEqual(core.load_config()["times"], ["07:30"])
        cfg = {"times": ["06:00"], "default_items": ["傘"], "special": []}
        core.save_config(cfg)
        self.assertEqual(core.load_config(), cfg)


if __name__ == "__main__":
    unittest.main()
