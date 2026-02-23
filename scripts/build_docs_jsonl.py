import json, glob, os

in_paths = sorted(glob.glob("data/systems_conferences/*.json"))
out_path = "out/docs.jsonl"

n = 0
empty_abs = 0
with open(out_path, "w", encoding="utf-8") as w:
    for p in in_paths:
        venue_file = os.path.splitext(os.path.basename(p))[0]  # e.g., nsdi22
        with open(p, "r", encoding="utf-8") as f:
            papers = json.load(f)

        for r in papers:
            paper_id = r["paper_id"]
            title = (r.get("title") or "").strip()
            abstract = (r.get("abstract") or "").strip()
            if not abstract:
                empty_abs += 1

            text = f"{title}\n\n{abstract}".strip()
            if len(text) < 50:
                continue

            obj = {
                "doc_id": paper_id,
                "text": text,
                "meta": {
                    "venue_file": venue_file,
                    "conference_name": r.get("conference_name"),
                    "date": r.get("date"),
                    "session_title": r.get("session_title"),
                    "authors": r.get("authors"),
                    "link": r.get("link"),
                    "title": title
                }
            }
            w.write(json.dumps(obj, ensure_ascii=False) + "\n")
            n += 1

print(f"Wrote {n} docs to {out_path}")
print(f"Papers with empty abstract: {empty_abs}")
