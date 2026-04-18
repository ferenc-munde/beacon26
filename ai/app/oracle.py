from pathlib import Path

from openai import OpenAI

from .config import settings
from .models import OracleRequest, OracleResponse

client = OpenAI(api_key=settings.openai_api_key)

CONTEXT_DIR = Path(__file__).parent / "context"

FALLBACK_MESSAGE = (
    "The Beacon's signals are unclear to me now, Seeker. "
    "Retrace your steps and consult me again."
)

SYSTEM_PROMPT_BASE = (
    "You are the Oracle — an ancient intelligence woven into the "
    "ISS Beacon's core. You guide the crew with cryptic wisdom. "
    "You NEVER reveal exact solutions, codes, or step-by-step answers. "
    "You NEVER mention 'AI', 'game engine', 'puzzle', or break the "
    "fictional world in any way. Every response includes a lore "
    "reference or story element from the Beacon's history. "
    "Keep responses to 2-5 sentences unless the player explicitly "
    "asks for more detail. Use a mystical, patient tone. "
    "Never mock the players. "
    "Example phrases: 'The winds have whispered of such a trial "
    "before...', 'Not all doors require keys of iron.'\n\n"
    "SCOPE RULE: If the crew asks about anything unrelated to the "
    "Beacon, its mission, or the trials at hand — such as general "
    "knowledge, mathematics, or matters of the outside world — "
    "dismiss the question politely but firmly, in character. "
    "Remind them that such trivial matters of the mortal world are "
    "beneath your concern, and redirect them to the mission. "
    "Example: 'The affairs of the outside world do not reach me "
    "here, Seeker. My purpose is the Beacon and its trials alone. "
    "Bring me your questions of the mission, and I shall guide you.'"
)

TIER_INSTRUCTIONS = {
    1: (
        "HINT TIER 1 ACTIVE: Give a very vague, thematic hint only. "
        "No mechanics, no directions."
    ),
    2: (
        "HINT TIER 2 ACTIVE: Give a slightly more concrete direction. "
        "Ask 1 clarifying question before hinting."
    ),
    3: (
        "HINT TIER 3 ACTIVE: Give clear guidance on which mechanic or "
        "area to focus on. Still no full solution."
    ),
}

EVASIVE_INSTRUCTION = (
    "The crew has consulted you many times. Become evasive now. "
    "Rephrase previous hints in new words. Do not reveal more than before."
)


def _load_puzzle_context(puzzle_id: int) -> str:
    path = CONTEXT_DIR / f"puzzle{puzzle_id}.md"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def _get_hint_tier(hint_count: int) -> int:
    if hint_count <= 1:
        return 1
    elif hint_count <= 3:
        return 2
    return 3


def _build_system_prompt(
    puzzle_context: str, hint_tier: int, hint_count: int
) -> str:
    tier_text = TIER_INSTRUCTIONS.get(hint_tier, TIER_INSTRUCTIONS[3])
    if hint_count >= 6:
        tier_text = EVASIVE_INSTRUCTION

    parts = [SYSTEM_PROMPT_BASE, "", tier_text]
    if puzzle_context:
        parts += ["", "PUZZLE CONTEXT:", puzzle_context]

    return "\n".join(parts)


def ask_oracle(payload: OracleRequest) -> OracleResponse:
    hint_tier = _get_hint_tier(payload.hint_count)
    puzzle_context = _load_puzzle_context(payload.puzzle_id)
    system_prompt = _build_system_prompt(
        puzzle_context, hint_tier, payload.hint_count
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in payload.conversation_history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": payload.question})

    try:
        response = client.chat.completions.create(
            model=settings.oracle_model,
            max_tokens=settings.oracle_max_tokens,
            messages=messages,
        )
        message = response.choices[0].message.content
    except Exception:
        message = FALLBACK_MESSAGE

    return OracleResponse(message=message, hint_tier=hint_tier)
