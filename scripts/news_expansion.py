"""Additional vetted discovery sources for MeshkiDo.

Public Telegram channel pages are read without a Telegram bot. Only clearly
identified Iranian scripted series already in the catalogue can be published.
Unknown series are queued for editorial verification, never published directly.
"""
import datetime as dt
import html
import re
import urllib.request
from html.parser import HTMLParser

CHANNELS = (
    {"name": "فیلیمو (رسمی)", "username": "Filimo", "kind": "official"},
    {"name": "فیلم‌نت (رسمی)", "username": "filmnetofficial", "kind": "official"},
    {"name": "نماوا (رسمی)", "username": "namava_ir", "kind": "official"},
    {"name": "فیلم‌نیوز", "username": "Film_News", "kind": "editorial"},
    {"name": "صبا", "username": "sabanews_ir", "kind": "editorial"},
)
EXCLUDED = (
    "سریال خارجی", "سریال ترکی", "سریال کره", "سریال آمریکایی",
    "سریال هندی", "سریال اسپانیایی", "نتفلیکس", "دوبله فارسی",
    "فیلم سینمایی", "سینما آنلاین", "فیلم کوتاه", "تئاتر",
    "رئالیتی شو", "رئالیتی‌شو", "مسابقه", "تاک شو", "تاک‌شو",
)
EVENTS = ("سریال", "قسمت", "پخش", "تیزر", "پوستر", "فصل", "ساخت",
          "تولید", "فیلمبرداری", "فیلم‌برداری", "تصویربرداری",
          "کارگردان", "بازیگر", "آنونس", "تریلر")
PUBLISH_EVENTS = ("منتشر", "پخش", "قسمت", "تیزر", "پوستر",
                  "آغاز", "پایان", "رونمایی", "ساخت", "تولید",
                  "تصویربرداری", "کارگردان", "بازیگر", "آنونس")
FA_NUM = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

def normalize(value):
    value = html.unescape(str(value or "")).translate(FA_NUM)
    value = re.sub(r"[\u064b-\u065f\u0670]", "", value)
    value = value.replace("ي", "ی").replace("ك", "ک").replace("ۀ", "ه")
    value = value.replace("\u200c", " ").replace("_", " ").replace("#", " ")
    return " ".join(value.casefold().split())

def fresh(value, now, hours=72):
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        parsed = parsed.astimezone(dt.timezone.utc)
    except (TypeError, ValueError):
        return None
    age = now - parsed
    return parsed if dt.timedelta(hours=-2) <= age <= dt.timedelta(hours=hours) else None

class PublicTelegramParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.current = None
        self.wrapper_depth = None
        self.text_depth = None
        self.records = []

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if tag == "div":
            self.depth += 1
            if attrs.get("data-post") and "tgme_widget_message" in attrs.get("class", ""):
                self.current = {"post": attrs["data-post"], "text": [], "date": None}
                self.wrapper_depth = self.depth
                self.text_depth = None
            elif self.current is not None and "tgme_widget_message_text" in attrs.get("class", ""):
                self.text_depth = self.depth
        if self.current is not None and tag == "time" and attrs.get("datetime"):
            self.current["date"] = attrs["datetime"]
        if tag == "br" and self.current is not None and self.text_depth is not None:
            self.current["text"].append("\n")

    def handle_data(self, data):
        if self.current is not None and self.text_depth is not None:
            self.current["text"].append(data)

    def handle_endtag(self, tag):
        if tag == "div":
            if self.current is not None and self.text_depth == self.depth:
                self.text_depth = None
            if self.current is not None and self.wrapper_depth == self.depth:
                self.current["text"] = "".join(self.current["text"]).strip()
                if self.current["text"] and self.current["date"]:
                    self.records.append(self.current)
                self.current = None
                self.wrapper_depth = None
                self.text_depth = None
            self.depth = max(0, self.depth - 1)

def parse_telegram_html(source, page):
    parser = PublicTelegramParser()
    parser.feed(page)
    expected = source["username"].lower() + "/"
    records = []
    for record in parser.records:
        post = record["post"]
        if not post.lower().startswith(expected):
            continue
        number = post.rsplit("/", 1)[-1]
        if not number.isdecimal():
            continue
        records.append({
            "title": record["text"][:2000],
            "published": record["date"],
            "url": "https://t.me/" + source["username"] + "/" + number,
        })
    return records

def fetch_telegram(source):
    url = "https://t.me/s/" + source["username"]
    request = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; MeshkiDoDiscovery/1.0)",
        "Accept": "text/html",
    })
    with urllib.request.urlopen(request, timeout=14) as response:
        payload = response.read(1_500_001)
    if len(payload) > 1_500_000:
        raise ValueError("Telegram page exceeds 1.5MB")
    return parse_telegram_html(source, payload.decode("utf-8", "replace"))

def match_series(text, show):
    title = normalize(show["title"])
    body = normalize(text)
    if not title or not body:
        return False
    if any(normalize(x) in body for x in EXCLUDED):
        return False
    # Require context CLOSE to the known title, not elsewhere in a long post.
    pattern = re.compile(r"(?<!\w)" + re.escape(title) + r"(?!\w)")
    for match in pattern.finditer(body):
        around = body[max(0, match.start()-55):match.end()+55]
        if "برنامه" in around and "سریال" not in around:
            continue
        if len(title) <= 3:
            if re.search(r"(?:سریال|مجموعه)\s+[«\"']?" +
                         re.escape(title) + r"(?!\w)", around):
                return True
        elif any(cue in around for cue in EVENTS):
            return True
    return False

def verified_post(record, show, source, now):
    date = fresh(record.get("published"), now)
    body = record.get("title", "")
    if not date or not match_series(body, show):
        return None
    norm = normalize(body)
    if not any(cue in norm for cue in PUBLISH_EVENTS):
        return None
    lines = [line.strip().replace("#", "").replace("_", " ")
             for line in body.splitlines() if line.strip()]
    title = normalize(show["title"])
    relevant = next((s for s in lines if title in normalize(s) and
                     any(cue in normalize(s) for cue in PUBLISH_EVENTS)), "")
    # Official teaser captions commonly put "تیزر قسمت..." and the series
    # title on separate lines. Keep the evidence together rather than dropping it.
    if not relevant:
        named = next((s for s in lines if title in normalize(s)), "")
        if named:
            nearby = [s for s in lines if any(cue in normalize(s) for cue in
                      ("تیزر", "آنونس", "تریلر", "پوستر", "قسمت", "رونمایی"))]
            relevant = " — ".join([nearby[0], named]) if nearby and nearby[0] != named else named
    if not relevant:
        return None
    label = re.sub(r"\s+", " ", relevant).strip(" \t-—•🎬📺")
    if not label:
        return None
    if len(label) > 115:
        label = label[:112].rsplit(" ", 1)[0].rstrip("،؛:— ") + "…"
    date_local = date.astimezone(dt.timezone(dt.timedelta(hours=3, minutes=30)))
    return {
        "date": date_local.date().isoformat(),
        "dateFa": date_local.strftime("%Y-%m-%d") + " (تهران)",
        "series": show["slug"],
        "title": (label[:135] + " | " + source["name"])[:220],
        "summary": "«" + source["name"] + "» اطلاعات تازه‌ای دربارهٔ سریال «" +
                   show["title"] + "» منتشر کرده است. جزئیات در پیوند اصلی قابل بررسی است.",
        "source": record["url"],
        "sourceName": source["name"],
        "automated": True,
        "publishedAt": date.isoformat(),
    }

def discover_unknown(record, known_shows, source, now):
    date = fresh(record.get("published"), now, hours=168)
    text = normalize(record.get("title", ""))
    if not date or any(normalize(bad) in text for bad in EXCLUDED):
        return []
    if any(match_series(record.get("title", ""), show) for show in known_shows):
        return []
    # Explicit, quoted series titles only. Mentions of generic programmes or
    # foreign shows cannot automatically add a new public series to the site.
    raw = html.unescape(record.get("title", ""))
    titles = re.findall(r"سریال\s+[«\"]([^»\"]{3,55})[»\"]", raw)
    titles += [name.replace("_", " ") for name in re.findall(
        r"سریال\s+#([\w\u0600-\u06ff_]{3,55})", raw)]
    found = []
    for title in titles[:3]:
        title = " ".join(title.split()).strip("، .!؟")
        if not 3 <= len(title) <= 55 or title.startswith(("جدید", "ایرانی", "خارجی")):
            continue
        if any(normalize(title) == normalize(s["title"]) for s in known_shows):
            continue
        found.append({
            "title": title, "status": "needs-review", "source": record["url"],
            "sourceName": source["name"], "publishedAt": date.isoformat(),
        })
    return found
