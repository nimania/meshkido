import datetime as dt
import importlib.util
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "collect_news.py"
spec = importlib.util.spec_from_file_location("news_collector", SCRIPT)
news = importlib.util.module_from_spec(spec)
spec.loader.exec_module(news)

class NewsCollectorTests(unittest.TestCase):
    def setUp(self):
        self.show = {"slug": "konkel", "title": "کنکل"}
        self.now = dt.datetime(2026, 10, 31, 12, tzinfo=dt.timezone.utc)

    def item(self, title, publisher="ایسنا", date="Sat, 31 Oct 2026 10:00:00 GMT"):
        xml = f"<item><title>{title}</title><link>https://news.google.com/rss/articles/123</link><pubDate>{date}</pubDate><source>{publisher}</source></item>"
        return ET.fromstring(xml)

    def test_verified_series_news_passes(self):
        row = news.candidate(self.item("خبر تازه از سریال کنکل"), self.show, self.now)
        self.assertEqual(row["series"], "konkel")
        self.assertIn("قابل بررسی", row["summary"])

    def test_unrelated_or_unsourced_rejected(self):
        self.assertIsNone(news.candidate(self.item("خبر ترافیک تهران"), self.show, self.now))
        self.assertIsNone(news.candidate(self.item("خبر سریال کنکل", "سایت نامعتبر"), self.show, self.now))

    def test_old_and_download_news_rejected(self):
        self.assertIsNone(news.candidate(self.item("خبر سریال کنکل", date="Fri, 20 Oct 2026 10:00:00 GMT"), self.show, self.now))
        self.assertIsNone(news.candidate(self.item("دانلود رایگان قسمت سریال کنکل"), self.show, self.now))

if __name__ == "__main__":
    unittest.main()
