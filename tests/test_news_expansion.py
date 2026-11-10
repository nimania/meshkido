import datetime as dt
import unittest

from scripts.news_expansion import (
    CHANNELS, discover_unknown, match_series, parse_telegram_html, verified_post,
)

NOW = dt.datetime(2026, 11, 1, 18, tzinfo=dt.timezone.utc)
SHOWS = [
    {"slug": "sorkh-o-siah", "title": "سرخ و سیاه"},
    {"slug": "yal", "title": "یَل"},
    {"slug": "konkel", "title": "کنکل"},
]

class TelegramSeriesTests(unittest.TestCase):
    def test_parse_public_message_with_timestamp_and_canonical_link(self):
        page = """
          <div class="tgme_widget_message js-widget_message" data-post="Filimo/12345">
            <div class="tgme_widget_message_text js-message_text">
                قسمت سوم سریال #سرخ_و_سیاه منتشر شد<br>فیلیمو
            </div>
            <time datetime="2026-11-01T15:00:00+00:00"></time>
          </div>
        """
        records = parse_telegram_html(CHANNELS[0], page)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["url"], "https://t.me/Filimo/12345")
        record = verified_post(records[0], SHOWS[0], CHANNELS[0], NOW)
        self.assertIsNotNone(record)
        self.assertIn("سریال", record["summary"])
        self.assertEqual(record["source"], "https://t.me/Filimo/12345")

    def test_multiline_official_teaser_caption(self):
        record = {
            "title": "این بار چه اتفاقی می‌افتد؟\\nتیزر قسمت پنجم\\n"
                     "سریال «یَل»\\nجمعه‌ها در فیلم‌نت",
            "published": "2026-11-01T12:00:00+00:00",
            "url": "https://t.me/filmnetofficial/12345",
        }
        item = verified_post(record, SHOWS[1], CHANNELS[1], NOW)
        self.assertIsNotNone(item)
        self.assertIn("تیزر قسمت پنجم", item["title"])
        self.assertIn("یَل", item["title"])

    def test_not_film_or_foreign_or_mention_in_unrelated_program(self):
        self.assertFalse(match_series("فیلم سینمایی «سرخ و سیاه» اکران شد", SHOWS[0]))
        self.assertFalse(match_series("قسمت ۲ سریال خارجی کنکل از نتفلیکس", SHOWS[2]))
        self.assertFalse(match_series(
            "داستان کنکل را در قسمت دوم برنامه فیلیموسیت بشنوید", SHOWS[2]))
        self.assertTrue(match_series(
            "قسمت چهارم سریال «یَل» هم‌اکنون در فیلم‌نت", SHOWS[1]))

    def test_unknown_series_queued_but_never_published_automatically(self):
        record = {
            "title": "سریال «مردگی» در مرحله تصویربرداری است",
            "published": "2026-11-01T12:00:00+00:00",
            "url": "https://t.me/Film_News/999",
        }
        suggestions = discover_unknown(record, SHOWS, CHANNELS[2], NOW)
        self.assertEqual([x["title"] for x in suggestions], ["مردگی"])
        self.assertEqual(suggestions[0]["status"], "needs-review")
        foreign = dict(record, title="سریال خارجی «مردگی» دوبله شد")
        self.assertEqual(discover_unknown(foreign, SHOWS, CHANNELS[2], NOW), [])
        old = dict(record, published="2026-10-01T12:00:00+00:00")
        self.assertEqual(discover_unknown(old, SHOWS, CHANNELS[2], NOW), [])

    def test_no_tg_html_injection_or_lookalike_channel(self):
        page = """
          <div class="tgme_widget_message" data-post="FakeFilimo/123">
            <div class="tgme_widget_message_text">سریال «یل»</div>
            <time datetime="2026-11-01T15:00:00Z"></time>
          </div>
        """
        self.assertEqual(parse_telegram_html(CHANNELS[0], page), [])

if __name__ == "__main__":
    unittest.main()
