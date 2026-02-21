"""Shared state for pipeline results (Approach A — avoid parsing orchestrator NL output)."""

analysis_state = {
    "claims": [],
    "fact_checks": [],
    "score": {},
    "memo": "",
    "audio_filename": "",
    "competitors": []
}
