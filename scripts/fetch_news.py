"""The news crawl — thesis-filtered story clusters (the Ground News move,
with our axis: which nodes and forces a story touches instead of left/right).

Pipeline: Google News RSS queries (data/feeds.json) → parse → match every
item against the entity + force lexicon → drop unmatched (thesis filter) →
cluster near-duplicate titles → data/news.json, newest first. Re-run to
refresh; it's idempotent and stateless.
"""

from __future__ import annotations

import datetime
import json
import os
import re
import time
from urllib.parse import quote

import feedparser

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Entity lexicon: node id → title-matching aliases (word-boundary, case-insensitive)
ENTITY_ALIASES = {
    "NVIDIA": ["nvidia"], "TSMC": ["tsmc", "taiwan semiconductor"], "ASML": ["asml"],
    "OPENAI": ["openai"], "ANTHROPIC": ["anthropic", "claude"], "XAI": ["xai", "grok"],
    "MISTRAL": ["mistral"], "GOOGLE": ["google", "alphabet", "deepmind", "gemini"],
    "MICROSOFT": ["microsoft", "azure"], "AMAZON": ["amazon", "aws"], "META": ["meta platforms", "meta ai", "llama"],
    "SK_HYNIX": ["sk hynix", "hynix"], "MICRON": ["micron"], "SAMSUNG": ["samsung"],
    "AMD": ["amd"], "BROADCOM": ["broadcom"], "INTEL": ["intel"], "QUALCOMM": ["qualcomm"],
    "ORACLE": ["oracle"], "COREWEAVE": ["coreweave"], "NEBIUS": ["nebius"],
    "SOFTBANK": ["softbank"], "TESLA": ["tesla", "optimus"], "FIGURE": ["figure ai"],
    "ALIBABA": ["alibaba", "qwen"], "TENCENT": ["tencent"], "BAIDU": ["baidu"],
    "BYTEDANCE": ["bytedance"], "DEEPSEEK": ["deepseek"], "HUAWEI": ["huawei", "ascend"],
    "SMIC": ["smic"], "AMAT": ["applied materials"], "LRCX": ["lam research"],
    "KLAC": ["kla corp", "kla-tencor"], "TEL": ["tokyo electron"], "ARM": ["arm holdings"],
    "VERTIV": ["vertiv"], "ARISTA": ["arista"], "CONSTELLATION": ["constellation energy"],
    "VISTRA": ["vistra"], "GEVERNOVA": ["ge vernova"], "FOXCONN": ["foxconn", "hon hai"],
    "SMCI": ["super micro", "supermicro"], "DELL": ["dell"], "IBIDEN": ["ibiden"],
    "LASERTEC": ["lasertec"], "DISCO": ["disco corp"], "SHIN_ETSU": ["shin-etsu"],
    "HOYA": ["hoya"], "COHERENT": ["coherent corp"], "FABRINET": ["fabrinet"],
}

# Force lexicon: snapshot id → keywords
FORCE_KEYWORDS = {
    "POWER_WALL": ["data center power", "power grid", "interconnection", "transformer", "nuclear", "gigawatt", "megawatt", "electricity", "ppa"],
    "HBM_SUPERCYCLE": ["hbm", "high-bandwidth memory", "dram", "memory chip"],
    "CIRCULAR_FINANCING": ["circular", "vendor financing", "ai bubble", "capex", "compute deal", "backstop", "stargate"],
    "EXPORT_CONTROL_REGIME": ["export control", "export ban", "bis ", "entity list", "chip ban", "rare earth", "gallium", "germanium", "tariff"],
    "PACKAGING_BOTTLENECK": ["cowos", "advanced packaging", "abf substrate", "osat", "chiplet"],
    "TALENT_DIASPORA": ["poach", "joins openai", "joins anthropic", "departs", "researcher", "chief scientist", "acqui-hire"],
    "ROBOTICS_EMBODIMENT": ["humanoid", "robot", "robotics", "optimus", "embodied"],
    "MACRO_LIQUIDITY": ["fed ", "rate cut", "private credit", "bond", "ipo", "valuation"],
    "MATERIALS_ENVIRONMENT": ["photoresist", "pfas", "wafer", "ultrapure", "neon gas", "water usage", "materials"],
}

WORD = re.compile(r"[a-z0-9][a-z0-9\-']*")

# Precompiled word-boundary matchers ("intel" must not match "intelligence")
ENTITY_RE = {
    nid: re.compile(r"\b(?:" + "|".join(re.escape(a) for a in aliases) + r")\b")
    for nid, aliases in ENTITY_ALIASES.items()
}
FORCE_RE = {
    fid: re.compile(r"(?:" + "|".join(re.escape(k.strip()) for k in kws) + r")")
    for fid, kws in FORCE_KEYWORDS.items()
}
# Broker-note / fund-filing spam that Google News surfaces for any ticker
JUNK = re.compile(
    r"stake|holdings in|position in|shares (?:bought|sold|purchased)|price target|"
    r"buys? \d|sells? \d|invests? in nvidia corporation|weekly options|short interest|"
    r"analyst ratings|\bETF\b|dividend",
    re.I,
)


def match(title: str):
    t = title.lower()
    nodes = [nid for nid, rx in ENTITY_RE.items() if rx.search(t)]
    forces = [fid for fid, rx in FORCE_RE.items() if rx.search(t)]
    return nodes, forces


def tokens(title: str):
    return set(WORD.findall(title.lower())) - {"the", "a", "an", "of", "to", "in", "for", "and", "on", "with", "as", "its"}


def main() -> None:
    feeds = json.load(open(os.path.join(BASE, "data", "feeds.json")))
    items, seen_links = [], set()
    for q in feeds["google_news_queries"]:
        url = f"https://news.google.com/rss/search?q={quote(q)}+when:2d&hl=en-US&gl=US&ceid=US:en"
        parsed = feedparser.parse(url)
        for e in parsed.entries[:20]:
            link = e.get("link", "")
            if not link or link in seen_links:
                continue
            seen_links.add(link)
            raw_title = e.get("title", "")
            # Google News titles end with " - Publisher"
            m = re.match(r"^(.*)\s+-\s+([^-]+)$", raw_title)
            title, publisher = (m.group(1), m.group(2)) if m else (raw_title, e.get("source", {}).get("title", "unknown"))
            if JUNK.search(title):
                continue  # broker-note spam
            nodes, forces = match(title)
            if not nodes and not forces:
                continue  # the thesis filter
            try:
                ts = time.mktime(e.published_parsed) if e.get("published_parsed") else time.time()
            except Exception:
                ts = time.time()
            items.append({
                "title": title.strip(), "publisher": publisher.strip(), "url": link,
                "published": datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M"),
                "ts": ts, "nodes": nodes, "forces": forces, "tokens": tokens(title),
            })

    # cluster: greedy — same lead entity/force and title-token Jaccard >= 0.35
    items.sort(key=lambda i: -i["ts"])
    clusters = []
    for it in items:
        placed = False
        for c in clusters:
            rep = c["items"][0]
            inter = len(it["tokens"] & rep["tokens"])
            union = len(it["tokens"] | rep["tokens"]) or 1
            shared_entity = bool(set(it["nodes"]) & set(rep["nodes"]))
            if inter / union >= 0.35 and (shared_entity or not it["nodes"]):
                c["items"].append(it)
                placed = True
                break
        if not placed:
            clusters.append({"items": [it]})

    stories = []
    for i, c in enumerate(sorted(clusters, key=lambda c: (-len(c["items"]), -c["items"][0]["ts"]))):
        its = c["items"]
        nodes = sorted({n for it in its for n in it["nodes"]})
        forces = sorted({f for it in its for f in it["forces"]})
        stories.append({
            "id": f"S{i:03d}",
            "headline": its[0]["title"],
            "nodes": nodes,
            "forces": forces,
            "source_count": len(its),
            "latest": its[0]["published"],
            "sources": [
                {"title": it["title"], "publisher": it["publisher"], "url": it["url"], "published": it["published"]}
                for it in its[:8]
            ],
        })

    out = {
        "_meta": {
            "fetched_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
            "note": "Thesis-filtered AI-industry news via Google News RSS. Headlines/links belong to their publishers; we store titles + links only. Matching is keyword-based (v1) — expect some misses and false positives.",
            "queries": feeds["google_news_queries"],
            "stories": len(stories),
        },
        "stories": stories[:80],
    }
    path = os.path.join(BASE, "data", "news.json")
    json.dump(out, open(path, "w"), indent=1)
    print(f"[✓] {path}: {len(items)} matched items → {len(stories)} story clusters")


if __name__ == "__main__":
    main()
