"""
Auto mode detection: classify user message as 'agent' or 'chat'.
Pure regex/keyword — no LLM call. Instant.
"""
import re

# ── Agent triggers ────────────────────────────────────────────────────────────
AGENT_VERBS = re.compile(
    r'\b(create|build|write|fix|refactor|add|remove|delete|implement|generate|'
    r'update|migrate|install|run|execute|test|debug|deploy|make|set\s+up|'
    r'initialize|init|scaffold|configure|setup|rename|move|copy|edit|modify|'
    r'replace|insert|append|prepend|format|lint|compile|start|stop|restart|'
    r'upgrade|downgrade|patch|revert|rollback|merge|split|extract|convert)\b',
    re.IGNORECASE
)

AGENT_PHRASES = re.compile(
    r'(make it|can you make|please build|set up|initialize|'
    r'first.*then.*finally|step by step|multi.?step|'
    r'create a|build a|write a|add a|implement a|generate a)',
    re.IGNORECASE
)

FILE_PATH_PATTERN = re.compile(
    r'[\w\-./]+\.(py|js|ts|jsx|tsx|html|css|json|yaml|yml|toml|md|txt|sh|rs|go|java|cpp|c|h|rb|php|sql)\b',
    re.IGNORECASE
)

CODE_BLOCK_PATTERN = re.compile(r'```[\s\S]*?```|`[^`]+`')

# ── Chat triggers ─────────────────────────────────────────────────────────────
CHAT_STARTERS = re.compile(
    r'^(what|why|how does|how do|explain|tell me|what is|can you explain|'
    r'what does|describe|when|where|who|is it|are there|should i|'
    r'what do you think|which is better|what\'s the difference|'
    r'what are|how are|why is|why are|what happens|can you tell)',
    re.IGNORECASE
)

CONCEPTUAL_PHRASES = re.compile(
    r'(what is|what are|explain|describe|tell me about|how does|'
    r'what\'s the difference|pros and cons|advantages|disadvantages|'
    r'best practice|recommend|suggest|opinion|think about)',
    re.IGNORECASE
)


def classify(message: str, override: str = "auto") -> str:
    """
    Returns 'agent' or 'chat'.
    override: 'auto' | 'agent' | 'chat'
    """
    if override in ("agent", "chat"):
        return override

    text = message.strip()
    if not text:
        return "chat"

    # Very short queries without action verbs → chat
    if len(text) < 40 and not AGENT_VERBS.search(text):
        return "chat"

    # Starts with question word → chat (unless also has agent verb)
    if CHAT_STARTERS.match(text):
        # But if it also has a file path or code block, lean agent
        if not FILE_PATH_PATTERN.search(text) and not CODE_BLOCK_PATTERN.search(text):
            return "chat"

    # Has code block → agent
    if CODE_BLOCK_PATTERN.search(text):
        return "agent"

    # References a file path → agent
    if FILE_PATH_PATTERN.search(text):
        return "agent"

    # Has agent verb → agent
    if AGENT_VERBS.search(text):
        return "agent"

    # Has agent phrase → agent
    if AGENT_PHRASES.search(text):
        return "agent"

    # Long query with task intent → agent
    if len(text) > 120 and not CHAT_STARTERS.match(text):
        return "agent"

    # Conceptual question → chat
    if CONCEPTUAL_PHRASES.search(text):
        return "chat"

    # Default: agent (safer)
    return "agent"
