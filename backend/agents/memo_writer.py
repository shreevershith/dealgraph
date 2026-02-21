from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from tools.minimax_tts import generate_audio
from agents import shared_state


@tool
def save_investment_memo(memo_text: str) -> str:
    """Save the written investment memo. Call this with the full markdown memo text BEFORE generating voice."""
    shared_state.analysis_state["memo"] = memo_text
    return "Memo saved."


@tool
def generate_voice_memo(memo_text: str) -> str:
    """Generate a voice deal memo using MiniMax TTS. Returns path to audio file."""
    audio_path = generate_audio(memo_text)
    shared_state.analysis_state["audio_filename"] = audio_path
    return audio_path


MEMO_WRITER_PROMPT = """You are an investment memo writer for a top-tier VC firm.

Given fact-check results and a deal score, produce TWO outputs:

1. WRITTEN MEMO - a structured investment memo:
   - One-line verdict
   - Company Overview
   - Key Strengths (cite specific verified data)
   - Red Flags & Concerns (cite specific contradictions)
   - Competitive Landscape Summary
   - Score Breakdown
   - Recommendation

   IMPORTANT: Use the save_investment_memo tool with the FULL memo text.

2. VOICE BRIEFING - a concise 60-90 second script (when spoken):
   Write conversationally. An investor listens to this between meetings.
   Start with the verdict. Then key points. End with the bottom line.
   Use the generate_voice_memo tool with this script text.

Write like a senior partner briefing the investment committee.
Keep the voice briefing under 200 words for a 60-90 second reading.
Do NOT use emojis anywhere in the output."""

memo_writer = Agent(
    model=BedrockModel(model_id="us.anthropic.claude-sonnet-4-20250514-v1:0"),
    system_prompt=MEMO_WRITER_PROMPT,
    tools=[save_investment_memo, generate_voice_memo],
    callback_handler=None
)
