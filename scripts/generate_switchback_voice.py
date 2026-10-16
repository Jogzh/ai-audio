#!/usr/bin/env python3
"""Generate original Switchback spoken one-shots with local Kokoro files.

Kokoro's native output is 24 kHz. Model/voice source (Apache-2.0):
https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh/tree/01e7505bd6a7a2ac4975463114c3a7650a9f7218
This script never downloads model files and refuses to overwrite existing output.
"""

from __future__ import annotations

import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import site
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "artifacts/vocal-model"
MODEL_REPO = "hexgrad/Kokoro-82M-v1.1-zh"
MODEL_REVISION = "01e7505bd6a7a2ac4975463114c3a7650a9f7218"
SAMPLE_RATE = 24_000
SEED = 20261016
ITEMS = [
    ("lights", "灯暗下来。"),
    ("frequency", "让频率接管。"),
    ("dont-look-back", "别回头。"),
    ("now", "现在。"),
    ("go", "走。"),
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out", type=Path, default=ROOT / "artifacts/audio/switchback/source",
        help="Output directory; existing output files are never overwritten.",
    )
    args = parser.parse_args()
    output = args.out.expanduser().resolve()
    config_path = MODEL_DIR / "config.json"
    model_path = MODEL_DIR / "kokoro-v1_1-zh.pth"
    voice_path = MODEL_DIR / "zm_010.pt"
    missing = [str(path) for path in (config_path, model_path, voice_path) if not path.is_file()]
    if missing:
        parser.error("Missing required local model/voice files: " + ", ".join(missing))
    targets = [output / f"voice-{slug}.wav" for slug, _ in ITEMS]
    targets.append(output / "provenance.json")
    existing = [str(path) for path in targets if path.exists()]
    if existing:
        parser.error("Refusing to overwrite existing output: " + ", ".join(existing))

    # Reuse this workspace's installed Kokoro and Mandarin G2P dependencies.
    site.addsitedir(str(ROOT / "artifacts/vocal-tools/lib/python3.11/site-packages"))
    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KModel, KPipeline

    torch.set_num_threads(6)
    torch.manual_seed(SEED)
    model = KModel(
        repo_id=MODEL_REPO, config=str(config_path), model=str(model_path),
    ).eval()
    pipeline = KPipeline(lang_code="z", repo_id=MODEL_REPO, model=model)
    output.mkdir(parents=True, exist_ok=True)
    records = []
    for slug, text in ITEMS:
        chunks, phonemes = [], []
        for result in pipeline(text, voice=str(voice_path), speed=1.0):
            chunks.append(result.audio.detach().cpu().numpy())
            phonemes.append(result.phonemes)
        if not chunks:
            raise RuntimeError(f"Kokoro returned no audio for {text!r}")
        raw = np.concatenate(chunks).astype("float32")
        # Retain 25 ms around content above -55 dBFS; apply no other effects.
        nonquiet = np.flatnonzero(np.abs(raw) > 10 ** (-55 / 20))
        start = max(0, int(nonquiet[0]) - 600) if len(nonquiet) else 0
        end = min(len(raw), int(nonquiet[-1]) + 601) if len(nonquiet) else len(raw)
        trimmed = raw[start:end]
        path = output / f"voice-{slug}.wav"
        sf.write(path, trimmed, SAMPLE_RATE, subtype="PCM_24")
        record = {
            "file": path.name, "text": text, "phonemes": phonemes,
            "sample_rate": SAMPLE_RATE, "channels": 1, "subtype": "PCM_24",
            "speed": 1.0, "pitch_shift_semitones": 0, "raw_samples": len(raw),
            "trim": {
                "method": "absolute amplitude threshold -55 dBFS with 25 ms margin",
                "start_sample": start, "end_sample_exclusive": end,
                "removed_head_seconds": start / SAMPLE_RATE,
                "removed_tail_seconds": (len(raw) - end) / SAMPLE_RATE,
            },
            "samples": len(trimmed), "duration_seconds": len(trimmed) / SAMPLE_RATE,
            "peak_dbfs": float(20 * np.log10(max(np.max(np.abs(trimmed)), 1e-10))),
            "sha256": sha256(path),
        }
        records.append(record)
        print(json.dumps(record, ensure_ascii=False), flush=True)
    provenance = {
        "created_date": datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat(),
        "source_type": "locally synthesized original spoken text",
        "generator": "Kokoro local inference", "model_repo": MODEL_REPO,
        "model_revision": MODEL_REVISION, "model_license": "Apache-2.0",
        "model_source": f"https://huggingface.co/{MODEL_REPO}/tree/{MODEL_REVISION}",
        "model_file": str(model_path.relative_to(ROOT)), "model_sha256": sha256(model_path),
        "config_sha256": sha256(config_path), "voice": "zm_010",
        "voice_file": str(voice_path.relative_to(ROOT)), "voice_sha256": sha256(voice_path),
        "seed": SEED, "device": "cpu", "torch_version": torch.__version__,
        "sample_rate": SAMPLE_RATE,
        "processing": "Silence trimming only. No pitch/time FX, dynamics, normalization, reverb, or EQ.",
        "items": records,
    }
    (output / "provenance.json").write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )


if __name__ == "__main__":
    main()
