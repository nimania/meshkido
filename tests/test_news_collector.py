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


    def test_partner_only_catalogued_iranian_series(self):
        p = next(s for s in news.PARTNER_SOURCES if s["name"] == "فیلم‌نت نیوز")
        good = {"title": "خبر تازه از سریال کنکل",
                "url": "https://filmnet.ir/news/konkel-update/",
                "published": "Sat, 31 Oct 2026 10:00:00 GMT"}
        self.assertIsNotNone(news.partner_candidate(good, self.show, p, self.now))
        foreign = dict(good, title="سریال خارجی کنکل در نتفلیکس")
        self.assertIsNone(news.partner_candidate(foreign, self.show, p, self.now))
        film = dict(good, title="فیلم سینمایی کنکل اکران شد")
        self.assertIsNone(news.partner_candidate(film, self.show, p, self.now))
        unrelated = dict(good, title="سریال خارجی جدید نتفلیکس")
        self.assertIsNone(news.partner_candidate(unrelated, self.show, p, self.now))
        wrong_host = dict(good, url="https://imposter-filmnet.ir/news/konkel")
        self.assertIsNone(news.partner_candidate(wrong_host, self.show, p, self.now))

    def test_partner_excludes_old_news_and_fake_google_redirect(self):
        p = news.PARTNER_SOURCES[1]
        row = {"title": "خبر تازه از سریال کنکل",
               "url": "https://www.namava.ir/mag/konkel/",
               "published": "Sat, 31 Oct 2026 10:00:00 GMT"}
        self.assertIsNotNone(news.partner_candidate(row, self.show, p, self.now))
        self.assertIsNone(news.partner_candidate(dict(row, published="Mon, 19 Oct 2026 10:00:00 GMT"),
                                                 self.show, p, self.now))
        self.assertIsNone(news.partner_candidate(dict(row, url="https://news.google.com/rss/articles/noverify"),
                                                 self.show, p, self.now))

if __name__ == "__main__":
    unittest.main()
