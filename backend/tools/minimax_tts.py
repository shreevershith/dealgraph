"""Text-to-speech using edge-tts (free Microsoft Edge TTS, no API key).

Generates high-quality MP3 audio locally.  No credits, no account needed.
Install: pip install edge-tts
"""

import os
import sys
import subprocess
import tempfile
from uuid import uuid4
from dotenv import load_dotenv

load_dotenv()

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

EDGE_TTS_VOICE = os.getenv("EDGE_TTS_VOICE", "en-US-GuyNeural")


def generate_audio(text: str) -> str:
    """Generate audio from text using edge-tts. Returns filename or empty string on failure."""
    filename = f"memo_{uuid4().hex[:8]}.mp3"
    filepath = os.path.join(AUDIO_DIR, filename)

    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as tmp:
            tmp.write(text)
            text_file = tmp.name

        result = subprocess.run(
            [
                sys.executable, "-m", "edge_tts",
                "--file", text_file,
                "--voice", EDGE_TTS_VOICE,
                "--write-media", filepath,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        os.unlink(text_file)

        if result.returncode == 0 and os.path.exists(filepath):
            print(f"[edge-tts] Generated {filename} ({os.path.getsize(filepath)} bytes)")
            return filename

        print(f"[edge-tts] Failed: {result.stderr[:300]}")
        return ""

    except Exception as e:
        print(f"[edge-tts] Error: {e}")
        return ""
