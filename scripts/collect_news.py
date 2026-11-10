#!/usr/bin/env python3
"""Conservative automated news discovery for MeshkiDo.

Discover recent articles about explicitly catalogued Iranian TV/streaming shows.
Do not infer episode releases, story plots, or editorially review material.
The original editorial entries are retained exactly.
"""
import argparse
import datetime as dt
import email.utils
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
try:
    from scripts.news_expansion import (CHANNELS, normalize as normalize_discovery,
        fetch_telegram, verified_post, discover_unknown, match_series)
except ModuleNotFoundError:
    # Executing scripts/collect_news.py directly adds scripts/, not repo root, to sys.path.
    from news_expansion import (CHANNELS, normalize as normalize_discovery,
        fetch_telegram, verified_post, discover_unknown, match_series)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TEHRAN = dt.timezone(dt.timedelta(hours=3, minutes=30))
UTC = dt.timezone.utc
GOOGLE_RSS = "https://news.google.com/rss/search?"
SOURCES = {
    "ایسنا", "مهر", "خبرگزاری مهر", "تسنیم", "خبرگزاری تسنیم",
    "ایرنا", "خبرگزاری ایرنا", "خبرآنلاین", "سینماپرس",
    "بانی فیلم", "صبا", "روزنامه صبا", "فیلم نیوز", "فیلم‌نیوز",
    "فارس", "خبرگزاری فارس", "همشهری آنلاین", "برنا",
    "آخرین خبر", "هنرآنلاین", "خبرگزاری صدا و سیما", "باشگاه خبرنگاران جوان",
}
BAD = ("دانلود رایگان", "لینک دانلود", "دانلود قسمت", "تماشای آنلاین رایگان",
       "قسمت کامل", "سریال ترکی", "دوبله فارسی", "زیرنویس فارسی")
MAX_AGE_HOURS = 72
MAX_NEW = 60
MAX_TOTAL = 600

def clean(s):
    s = html.unescape(re.sub(r"<[^>]*>", " ", str(s or "")))
    return " ".join(s.split()).strip()

def normalize(s):
    return (clean(s).replace("ي", "ی").replace("ك", "ک").replace("‌", " ")
            .replace("ۀ", "ه").casefold())

def fresh(when, now):
    if not when:
        return False
    delta = now - when
    return dt.timedelta(hours=-2) <= delta <= dt.timedelta(hours=MAX_AGE_HOURS)

def title_matches(headline, show):
    title = normalize(headline)
    candidate = normalize(show["title"])
    if len(candidate) < 4:
        return False
    # A named series plus an editorial context cue is required. Generic mentions
    # of short titles such as "تاکسی" remain ineligible.
    context = ("سریال", "مجموعه", "قسمت", "فصل", "تیزر", "پوستر",
               "تریلر", "آنونس", "بازیگر", "کارگردان", "تصویربرداری",
               "رونمایی", "پخش", "پشت صحنه", "پشت‌صحنه", "سکانس",
               "تولید", "فیلمبرداری", "فیلم‌برداری", "نقش", "اکران",
               "خبر", "مصاحبه", "زمان انتشار", "تمدید", "توقف", "پایان")
    return bool(re.search(r"(?<!\w)" + re.escape(candidate) + r"(?!\w)", title)) and (
        any(cue in title for cue in context)
    )

def rss_for(show):
    phrase = '"' + show["title"] + '" سریال'
    query = urllib.parse.urlencode({"q": phrase, "hl": "fa", "gl": "IR", "ceid": "IR:fa"})
    request = urllib.request.Request(GOOGLE_RSS + query,
                                     headers={"User-Agent": "MeshkiDoNews/1.0 (+https://nimania.github.io/meshkido/)"})
    with urllib.request.urlopen(request, timeout=18) as response:
        payload = response.read(1_500_001)
        if len(payload) > 1_500_000:
            raise ValueError("RSS exceeds size limit")
    root = ET.fromstring(payload)
    return root.findall(".//channel/item")

def candidate(item, show, now):
    headline = clean(item.findtext("title"))
    source_node = item.find("source")
    publisher = clean(source_node.text if source_node is not None else "")
    url = clean(item.findtext("link"))
    pub = clean(item.findtext("pubDate"))
    if not title_matches(headline, show) or publisher not in SOURCES:
        return None
    if any(normalize(word) in normalize(headline) for word in BAD + FOREIGN):
        return None
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in ("news.google.com", "www.google.com"):
        return None
    try:
        when = email.utils.parsedate_to_datetime(pub).astimezone(UTC)
    except (ValueError, TypeError, IndexError):
        return None
    if not fresh(when, now):
        return None
    local = when.astimezone(TEHRAN)
    # Keep the original publisher's headline attributed, with no invented synopsis.
    return {
        "date": local.date().isoformat(),
        "dateFa": local.strftime("%Y-%m-%d") + " (تهران)",
        "series": show["slug"],
        "title": headline[:220],
        "summary": "«" + publisher + "» این خبر را دربارهٔ سریال «" + show["title"] +
                   "» منتشر کرده است. متن و جزئیات خبر در پیوند منبع قابل بررسی است.",
        "source": url,
        "sourceName": publisher + " / گوگل نیوز",
        "automated": True,
        "publishedAt": when.isoformat(),
    }


# Partner editorial sources requested for MeshkiDo. Their entire entertainment
# feeds are NOT eligible: only headlines naming a catalogued Iranian series pass.
PARTNER_SOURCES = (
    {"name": "فیلیمو شات", "domain": "filimo.com",
     "section": "/shot", "feed": "https://www.filimo.com/shot/feed/"},
    {"name": "مجله نماوا", "domain": "namava.ir",
     "section": "/mag", "feed": "https://www.namava.ir/mag/feed/"},
    {"name": "ویدئوهای نماوا", "domain": "namava.ir",
     "section": "/mag/category/video", "feed": "https://www.namava.ir/mag/category/video/feed/"},
    {"name": "فیلم‌نت نیوز", "domain": "filmnet.ir",
     "section": "/news", "feed": "https://filmnet.ir/news/category/news/feed/"},
    {"name": "فیلم‌نیوز", "domain": "filmnews.ir",
     "section": "/", "feed": "https://www.filmnews.ir/feed/"},
    {"name": "رسانه صبا", "domain": "sabanews.ir",
     "section": "/", "feed": "https://sabanews.ir/feed/"},
    {"name": "صبا خبر", "domain": "sabakhabar.ir",
     "section": "/", "feed": "https://sabakhabar.ir/feed/"},
)
FOREIGN = ("سریال خارجی", "سریال کره ای", "سریال کره‌ای", "سریال ترکی",
           "سریال آمریکایی", "سریال هندی", "سریال اسپانیایی",
           "محصول نتفلیکس", "سریال نتفلیکس", "دوبله فارسی")
FEED_NS = "{http://www.w3.org/2005/Atom}"

def from_partner_url(url, partner):
    parts = urllib.parse.urlsplit(clean(url))
    host = (parts.hostname or "").lower()
    permitted = partner["domain"]
    return (parts.scheme == "https" and host in (permitted, "www." + permitted)
            and parts.path.rstrip("/").startswith(partner["section"]))

def fetch_partner_feed(partner):
    request = urllib.request.Request(partner["feed"],
        headers={"User-Agent": "Mozilla/5.0 (compatible; MeshkiDoNews/1.1)",
                 "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
    with urllib.request.urlopen(request, timeout=14) as response:
        payload = response.read(1_500_001)
        if len(payload) > 1_500_000:
            raise ValueError("Partner feed too large")
    root = ET.fromstring(payload)
    if root.tag == FEED_NS + "feed":
        records = []
        for entry in root.findall(FEED_NS + "entry"):
            link = next((node.get("href") for node in entry.findall(FEED_NS + "link")
                         if node.get("rel", "alternate") == "alternate"), "")
            records.append({
                "title": entry.findtext(FEED_NS + "title"),
                "url": link,
                "published": entry.findtext(FEED_NS + "published") or entry.findtext(FEED_NS + "updated"),
            })
        return records
    return [{"title": row.findtext("title"), "url": row.findtext("link"),
             "published": row.findtext("pubDate") or row.findtext("{http://purl.org/dc/elements/1.1/}date")}
            for row in root.findall(".//channel/item")]

def partner_search(show, partner):
    # Restricted search is a fallback when an Iranian site blocks direct feeds.
    phrase = '"' + show["title"] + '" سریال site:' + partner["domain"] + partner["section"]
    query = urllib.parse.urlencode({"q": phrase, "hl": "fa", "gl": "IR", "ceid": "IR:fa"})
    request = urllib.request.Request(GOOGLE_RSS + query,
        headers={"User-Agent": "MeshkiDoNews/1.1"})
    with urllib.request.urlopen(request, timeout=14) as response:
        payload = response.read(1_500_001)
        if len(payload) > 1_500_000:
            raise ValueError("Partner search feed too large")
    root = ET.fromstring(payload)
    records = []
    for item in root.findall(".//channel/item"):
        source = item.find("source")
        # Google News only supplies a redirect link; require the verified
        # publisher domain before treating it as one of these partners.
        source_url = source.get("url", "") if source is not None else ""
        host = (urllib.parse.urlsplit(source_url).hostname or "").lower()
        if host not in (partner["domain"], "www." + partner["domain"]):
            continue
        url = clean(item.findtext("link"))
        target = urllib.parse.urlsplit(url)
        if target.scheme != "https" or target.hostname not in ("news.google.com", "www.google.com"):
            continue
        records.append({"title": item.findtext("title"), "url": url,
                        "published": item.findtext("pubDate"), "verified_domain": True})
    return records

def partner_date(value):
    try:
        t = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        try:
            t = email.utils.parsedate_to_datetime(value)
        except (ValueError, TypeError, IndexError):
            return None
    return t.replace(tzinfo=UTC) if t.tzinfo is None else t.astimezone(UTC)

def partner_candidate(item, show, partner, now):
    headline = clean(item.get("title"))
    title = normalize(headline)
    if (not title_matches(headline, show)
            or any(normalize(x) in title for x in BAD + FOREIGN)):
        return None
    url = clean(item.get("url"))
    if not (from_partner_url(url, partner) or item.get("verified_domain")):
        return None
    when = partner_date(item.get("published"))
    if not fresh(when, now):
        return None
    local = when.astimezone(TEHRAN)
    return {
        "date": local.date().isoformat(),
        "dateFa": local.strftime("%Y-%m-%d") + " (تهران)",
        "series": show["slug"],
        "title": headline[:220],
        "summary": "«" + partner["name"] + "» این خبر را دربارهٔ سریال ایرانی «" +
                   show["title"] + "» منتشر کرده است. برای جزئیات، منبع اصلی را ببینید.",
        "source": url,
        "sourceName": partner["name"],
        "automated": True,
        "publishedAt": when.isoformat(),
    }

def key(row):
    return (row.get("series"), normalize(row.get("title")))


def partner_search_all(partner):
    """One fallback query per blocked publisher, not one request per series."""
    query = urllib.parse.urlencode({
        "q": "site:" + partner["domain"] + " سریال",
        "hl": "fa", "gl": "IR", "ceid": "IR:fa",
    })
    request = urllib.request.Request(GOOGLE_RSS + query,
        headers={"User-Agent": "MeshkiDoNews/2.0"})
    with urllib.request.urlopen(request, timeout=14) as response:
        payload = response.read(1_500_001)
    if len(payload) > 1_500_000:
        raise ValueError("Search feed too large")
    root = ET.fromstring(payload)
    records = []
    for item in root.findall(".//channel/item"):
        source = item.find("source")
        raw_domain = (source.get("url", "") if source is not None else "")
        host = (urllib.parse.urlsplit(raw_domain).hostname or "").lower()
        if host not in (partner["domain"], "www." + partner["domain"]):
            continue
        url = clean(item.findtext("link"))
        target = urllib.parse.urlsplit(url)
        if target.scheme != "https" or target.hostname not in ("news.google.com", "www.google.com"):
            continue
        records.append({"title": item.findtext("title"), "url": url,
                        "published": item.findtext("pubDate"), "verified_domain": True})
    return records

def broad_series_search():
    """Discover unfamiliar productions from already-approved news outlets."""
    query = urllib.parse.urlencode({
        "q": '"سریال" "نمایش خانگی" OR "سریال" "در حال تولید"',
        "hl": "fa", "gl": "IR", "ceid": "IR:fa",
    })
    request = urllib.request.Request(GOOGLE_RSS + query,
        headers={"User-Agent": "MeshkiDoNews/2.0"})
    with urllib.request.urlopen(request, timeout=14) as response:
        payload = response.read(1_500_001)
    if len(payload) > 1_500_000:
        raise ValueError("Broad discovery feed too large")
    root = ET.fromstring(payload)
    records = []
    for item in root.findall(".//channel/item"):
        source = item.find("source")
        publisher = clean(source.text if source is not None else "")
        if publisher not in SOURCES:
            continue
        url = clean(item.findtext("link"))
        if urllib.parse.urlsplit(url).hostname not in ("news.google.com", "www.google.com"):
            continue
        title = clean(item.findtext("title"))
        # Broad discovery is suggestions ONLY, never direct site publication.
        if not ("سریال" in title and any(cue in title for cue in
                ("ایران", "فیلیمو", "فیلم‌نت", "شبکه", "نمایش خانگی",
                 "ساخت", "تولید", "تلویزیون", "پخش"))):
            continue
        records.append({"title": title, "url": url,
                        "published": item.findtext("pubDate")})
    return records

def queue_key(row):
    return normalize_discovery(row.get("title"))

def collect(now=None, fetcher=rss_for, mode="all"):
    now = now or dt.datetime.now(UTC)
    if mode not in ("all", "official", "editorial"):
        raise ValueError("Unknown source mode")
    shows = json.loads((DATA / "series.json").read_text(encoding="utf8"))["shows"]
    active = shows  # Cover productions, completed series and shows awaiting new seasons.
    current = json.loads((DATA / "updates.json").read_text(encoding="utf8"))
    old_current = json.loads(json.dumps(current))
    media_file = DATA / "media-feed.json"
    existing_media = json.loads(media_file.read_text(encoding="utf8")) if media_file.exists() else []
    old_media = json.loads(json.dumps(existing_media))
    media_by_url = {row["source"]: row for row in existing_media if row.get("source")}
    official_media = []
    assert isinstance(current, list) and current, "Refusing to replace empty editorial archive"
    queue_file = DATA / "discovery-queue.json"
    existing_queue = json.loads(queue_file.read_text(encoding="utf8")) if queue_file.exists() else []
    assert isinstance(existing_queue, list), "Invalid candidate queue"
    queue = list(existing_queue)
    seen_queue = {queue_key(r) for r in queue}
    known = {key(r) for r in current}
    found = []
    failures = []
    successes = 0
    scanned = {"telegram": 0, "publisher": 0, "google": 0}
    new_candidates = []

    by_source = {row.get("source"): row for row in current}
    def add_post(row):
        if not row:
            return
        previous = by_source.get(row.get("source"))
        if previous and row.get("mediaType") and not previous.get("mediaType"):
            previous["mediaType"] = row["mediaType"]
        if key(row) not in known:
            known.add(key(row))
            found.append(row)
            by_source[row.get("source")] = row

    def discover(record, name):
        for suggestion in discover_unknown(record, shows, {"name": name}, now):
            normalized = queue_key(suggestion)
            if normalized not in seen_queue:
                seen_queue.add(normalized)
                queue.append(suggestion)
                new_candidates.append(suggestion)

    # Official platforms are polled hourly; specialized newsrooms every 3h.
    channels = [c for c in CHANNELS if mode == "all" or
                (mode == "official" and c["kind"] == "official") or
                (mode == "editorial" and c["kind"] == "editorial")]
    for source in channels:
        try:
            records = fetch_telegram(source)
            if not records:
                raise ValueError("No public messages parsed; channel may block access")
            successes += 1
            scanned["telegram"] += len(records)
            for record in records:
                verified = [verified_post(record, show, source, now) for show in active]
                for post in verified:
                    add_post(post)
                # Public, original videos/photos of Iranian TV series can be
                # viewed through Telegram's official post widget on MeshkiDo.
                # Never promote generic ads, full episodes or unrelated films.
                caption = record.get("title", "")
                normalized = normalize_discovery(caption)
                cues = ("تیزر", "آنونس", "تریلر", "پشت صحنه", "پشت‌صحنه",
                        "پوستر", "معرفی سریال", "سریال", "قسمت")
                forbidden = ("فیلم سینمایی", "دانلود", "قسمت کامل",
                             "سریال خارجی", "سریال ترکی", "سریال کره",
                             "دوبله فارسی", "رئالیتی شو", "مسابقه")
                dated = partner_date(record.get("published"))
                if (source["kind"] == "official"
                        and record.get("mediaType") in ("video", "photo")
                        and dated and fresh(dated, now)
                        and any(normalize_discovery(x) in normalized for x in cues)
                        and not any(normalize_discovery(x) in normalized for x in forbidden)
                        and (any(verified) or "سریال" in normalized)):
                    official_media.append({
                        "source": record["url"], "sourceName": source["name"],
                        "title": clean(caption)[:240],
                        "mediaType": record["mediaType"],
                        "series": next((p["series"] for p in verified if p), None),
                        "publishedAt": dated.isoformat(),
                    })
                discover(record, source["name"])
        except Exception as exc:
            failures.append({"source": source["name"], "error": type(exc).__name__ + ": " + str(exc)[:160]})

    if mode != "official":
        # One feed (or a single domain-restricted search) per publisher.
        # A publisher outage never deletes previously verified editorial news.
        for partner in PARTNER_SOURCES:
            try:
                try:
                    records = fetch_partner_feed(partner)
                except Exception:
                    records = partner_search_all(partner)
                successes += 1
                scanned["publisher"] += len(records)
                for record in records:
                    for show in active:
                        add_post(partner_candidate(record, show, partner, now))
                    if from_partner_url(record.get("url", ""), partner) or record.get("verified_domain"):
                        discover(record, partner["name"])
            except Exception as exc:
                failures.append({"source": partner["name"], "error": type(exc).__name__ + ": " + str(exc)[:160]})

        for show in active:
            try:
                items = fetcher(show)
                successes += 1
                scanned["google"] += len(items)
                for item in items:
                    add_post(candidate(item, show, now))
            except Exception as exc:
                failures.append({"source": "گوگل نیوز", "series": show["slug"],
                                 "error": type(exc).__name__ + ": " + str(exc)[:160]})
        try:
            broad = broad_series_search()
            successes += 1
            scanned["google"] += len(broad)
            for record in broad:
                discover(record, "گوگل نیوز / رسانه تأییدشده")
        except Exception as exc:
            failures.append({"source": "کشف سریال‌های تازه", "error": type(exc).__name__ + ": " + str(exc)[:160]})

    if successes == 0:
        raise RuntimeError("Every requested source failed; preserving all previous data")
    for item in official_media:
        # A canonical public Telegram post URL is the stable media ID.
        media_by_url[item["source"]] = item
    media_feed = sorted(media_by_url.values(),
                        key=lambda row: row.get("publishedAt", ""), reverse=True)[:400]
    found.sort(key=lambda row: row["publishedAt"], reverse=True)
    manual = [row for row in current if not row.get("automated")]
    automatic = [row for row in current if row.get("automated")] + found[:MAX_NEW]
    automatic.sort(key=lambda row: row.get("publishedAt", ""), reverse=True)
    merged = manual + automatic[:max(0, MAX_TOTAL - len(manual))]
    merged.sort(key=lambda row: row.get("publishedAt") or row.get("date", ""), reverse=True)
    queue.sort(key=lambda row: row.get("publishedAt", ""), reverse=True)
    # Do not discard items awaiting review. Queue pruning is a deliberate human action.
    return old_current, merged, found[:MAX_NEW], failures, successes, existing_queue, queue, new_candidates, scanned, old_media, media_feed

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--mode", choices=("all", "official", "editorial"), default="all")
    args = parser.parse_args()
    old, updated, new, errors, successes, old_queue, queue, new_candidates, scanned, old_media, media_feed = collect(mode=args.mode)
    print(json.dumps({
        "mode": args.mode, "queries_ok": successes, "scanned": scanned,
        "errors": errors, "new": len(new), "new_series_candidates": len(new_candidates),
        "queue_total": len(queue), "total": len(updated),
        "media_total": len(media_feed), "media_changed": old_media != media_feed,
        "changed": updated != old, "queue_changed": queue != old_queue
    }, ensure_ascii=False))
    if not args.dry_run:
        for changed, data, filename in (
            (updated != old, updated, "updates.json"),
            (queue != old_queue, queue, "discovery-queue.json"),
            (old_media != media_feed, media_feed, "media-feed.json"),
        ):
            if changed:
                path = DATA / filename
                temporary = path.with_suffix(".tmp")
                temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
                temporary.replace(path)

if __name__ == "__main__":
    main()
