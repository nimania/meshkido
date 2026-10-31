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
}
BAD = ("دانلود رایگان", "لینک دانلود", "دانلود قسمت", "تماشای آنلاین رایگان",
       "قسمت کامل", "سریال ترکی", "دوبله فارسی", "زیرنویس فارسی")
MAX_AGE_HOURS = 72
MAX_NEW = 18
MAX_TOTAL = 220

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
    # Distinguish generic titles such as Taxi from unrelated transportation news.
    return bool(re.search(r"(?<!\w)" + re.escape(candidate) + r"(?!\w)", title)) and (
        "سریال" in title or "مجموعه" in title or "قسمت" in title or "فصل" in title
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
    if any(normalize(word) in normalize(headline) for word in BAD):
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

def key(row):
    return (row.get("series"), normalize(row.get("title")))

def collect(now=None, fetcher=rss_for):
    now = now or dt.datetime.now(UTC)
    shows = json.loads((DATA / "series.json").read_text(encoding="utf8"))["shows"]
    current = json.loads((DATA / "updates.json").read_text(encoding="utf8"))
    assert isinstance(current, list) and current, "Refusing to replace empty editorial archive"
    known = {key(r) for r in current}
    found = []
    failures = []
    successes = 0
    for show in shows:
        if show.get("status") != "در حال پخش":
            continue
        try:
            items = fetcher(show)
            successes += 1
            for item in items:
                row = candidate(item, show, now)
                if row and key(row) not in known:
                    known.add(key(row))
                    found.append(row)
        except Exception as exc:
            failures.append({"series": show["slug"], "error": type(exc).__name__ + ": " + str(exc)[:160]})
    if successes == 0:
        raise RuntimeError("Every source query failed; keeping previous content unchanged")
    found.sort(key=lambda row: row["publishedAt"], reverse=True)
    # Existing human-edited entries always survive. Trim only older auto-discovered entries.
    manual = [row for row in current if not row.get("automated")]
    automatic = [row for row in current if row.get("automated")] + found[:MAX_NEW]
    automatic.sort(key=lambda row: row.get("publishedAt", ""), reverse=True)
    merged = manual + automatic[:max(0, MAX_TOTAL-len(manual))]
    merged.sort(key=lambda row: row.get("publishedAt") or row.get("date", ""), reverse=True)
    return current, merged, found[:MAX_NEW], failures, successes

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    old, updated, new, errors, successes = collect()
    print(json.dumps({"queries_ok": successes, "errors": errors, "new": len(new),
                      "total": len(updated), "changed": updated != old}, ensure_ascii=False))
    if not args.dry_run and updated != old:
        path = DATA / "updates.json"
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        temporary.replace(path)

if __name__ == "__main__":
    main()
