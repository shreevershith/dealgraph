import os
import sys
import subprocess
import tempfile
from uuid import uuid4
from dotenv import load_dotenv

load_dotenv()

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  HACKATHON BUILD — MiniMax TTS API (cloud text-to-speech)                  ║
# ║  We used MiniMax's speech-02-turbo model during the hackathon to generate  ║
# ║  audio investment memos. Required MINIMAX_API_KEY and MINIMAX_GROUP_ID.    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
# import requests
#
# MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY")
# MINIMAX_GROUP_ID = os.getenv("MINIMAX_GROUP_ID", "")
#
# def generate_audio(text: str) -> str:
#     """Generate audio from text using MiniMax TTS. Returns filename."""
#     filename = f"memo_{uuid4().hex[:8]}.mp3"
#     filepath = os.path.join(AUDIO_DIR, filename)
#
#     try:
#         response = requests.post(
#             f"https://api.minimax.io/v1/t2a_v2?GroupId={MINIMAX_GROUP_ID}",
#             headers={
#                 "Authorization": f"Bearer {MINIMAX_API_KEY}",
#                 "Content-Type": "application/json",
#             },
#             json={
#                 "model": "speech-02-turbo",
#                 "text": text,
#                 "stream": False,
#                 "voice_setting": {
#                     "voice_id": "male-qn-qingse",
#                     "speed": 1.05,
#                     "vol": 1.0,
#                     "pitch": 0,
#                 },
#             },
#             timeout=30,
#         )
#
#         if response.status_code == 200:
#             data = response.json()
#             audio_hex = data.get("data", {}).get("audio", "")
#             if audio_hex:
#                 audio_bytes = bytes.fromhex(audio_hex)
#                 with open(filepath, "wb") as f:
#                     f.write(audio_bytes)
#                 return filename
#
#         print(f"MiniMax TTS failed: {response.status_code} {response.text[:200]}")
#         return "fallback_memo.mp3"
#
#     except Exception as e:
#         print(f"MiniMax TTS error: {e}")
#         return "fallback_memo.mp3"

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  OPEN-SOURCE VERSION — edge-tts (free Microsoft Edge TTS, no API key)      ║
# ║  Generates high-quality MP3 audio locally. No credits, no account needed.  ║
# ║  Install: pip install edge-tts                                             ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
EDGE_TTS_VOICE = os.getenv("EDGE_TTS_VOICE", "en-US-GuyNeural")


def generate_audio(text: str) -> str:
    """Generate audio from text using edge-tts. Returns filename."""
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
