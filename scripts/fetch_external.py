"""Fetch and normalize free external datasets — the map-the-maps layer.

Each source is fetched from its published location, filtered to our
universe, and written to data/external/ with attribution and license
recorded in _meta. Re-run to refresh. Currently: Epoch AI's notable
AI models database (CC BY, epoch.ai/data).
"""

from __future__ import annotations

import datetime
import json
import math
import os

import pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE, "data", "external")

EPOCH_URL = "https://epoch.ai/data/epochdb/notable_ai_models.csv"

# Epoch organization strings → our topology node ids
ORG_MAP = {
    "OpenAI": "OPENAI",
    "Anthropic": "ANTHROPIC",
    "Google": "GOOGLE",
    "Google DeepMind": "GOOGLE",
    "DeepMind": "GOOGLE",
    "Google Brain": "GOOGLE",
    "Google Research": "GOOGLE",
    "Meta AI": "META",
    "Meta": "META",
    "Facebook AI Research": "META",
    "xAI": "XAI",
    "Mistral AI": "MISTRAL",
    "DeepSeek": "DEEPSEEK",
    "Alibaba": "ALIBABA",
    "Alibaba Cloud": "ALIBABA",
    "Qwen Team": "ALIBABA",
    "ByteDance": "BYTEDANCE",
    "ByteDance Seed": "BYTEDANCE",
    "Baidu": "BAIDU",
    "Tencent": "TENCENT",
    "Huawei": "HUAWEI",
    "NVIDIA": "NVIDIA",
    "Microsoft": "MICROSOFT",
    "Microsoft Research": "MICROSOFT",
    "Amazon": "AMAZON",
    "Tesla": "TESLA",
}


def fetch_epoch() -> None:
    df = pd.read_csv(EPOCH_URL)
    df["org_id"] = df["Organization"].map(
        lambda o: next((v for k, v in ORG_MAP.items() if isinstance(o, str) and k in o), None)
    )
    df["date"] = pd.to_datetime(df["Publication date"], errors="coerce")
    df["compute"] = pd.to_numeric(df["Training compute (FLOP)"], errors="coerce")

    # keep: mapped-org models since 2020, or any model >= 1e25 FLOP
    keep = df[
        ((df["org_id"].notna()) & (df["date"] >= "2020-01-01"))
        | (df["compute"] >= 1e25)
    ].copy()
    keep = keep.sort_values("date")

    records = []
    for _, r in keep.iterrows():
        compute = float(r["compute"]) if pd.notna(r["compute"]) else None
        records.append(
            {
                "model": r["Model"],
                "organization": r["Organization"],
                "org_id": r["org_id"] if pd.notna(r["org_id"]) else None,
                "date": r["date"].strftime("%Y-%m-%d") if pd.notna(r["date"]) else None,
                "training_compute_flop": compute,
                "log10_flop": round(math.log10(compute), 2) if compute else None,
                "parameters": float(r["Parameters"]) if pd.notna(r["Parameters"]) else None,
                "domain": r["Domain"] if pd.notna(r["Domain"]) else None,
                "country": r["Country (of organization)"] if pd.notna(r.get("Country (of organization)")) else None,
                "link": r["Link"] if pd.notna(r.get("Link")) else None,
            }
        )

    out = {
        "_meta": {
            "source": "Epoch AI — Notable AI Models database",
            "url": EPOCH_URL,
            "license": "CC BY 4.0 (attribution: Epoch AI, epoch.ai/data)",
            "fetched_at": datetime.date.today().isoformat(),
            "rows_total": int(len(df)),
            "rows_kept": len(records),
            "filter": "mapped-org models since 2020, plus any model >= 1e25 FLOP",
        },
        "models": records,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "epoch_models.json")
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print(f"[✓] {path}: {len(records)} models (of {len(df)} in source)")


if __name__ == "__main__":
    fetch_epoch()
