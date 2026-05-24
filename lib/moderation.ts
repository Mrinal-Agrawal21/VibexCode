type ModerationHit = {
    hit: boolean;
    term?: string;
};

const DEFAULT_ABUSE_WORDS = [
    // English (mild-to-strong profanity)
    "fuck",
    "fucking",
    "fucker",
    "shit",
    "bullshit",
    "bastard",
    "asshole",
    "bitch",
    "dick",
    "moron",
    "idiot",
    "stupid",
    "dumb",
    "jerk",
    // Hindi (transliterated, ASCII)
    "chutiya",
    "chutia",
    "madarchod",
    "behenchod",
    "bhenchod",
    "gandu",
    "harami",
    "kutte",
    "saala",
    "bakwas",
    "pagal",
    "ullu",
];

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/(.)\1{2,}/g, "$1$1");
}

export function getAbuseWords(): string[] {
    const envList = process.env.ABUSE_WORDS;
    if (envList) {
        return envList
            .split(",")
            .map((w) => w.trim().toLowerCase())
            .filter(Boolean);
    }
    return DEFAULT_ABUSE_WORDS;
}

export function detectAbuse(text: string): ModerationHit {
    const normalized = ` ${normalizeText(text)} `;
    if (normalized.trim().length === 0) {
        return { hit: false };
    }

    for (const raw of getAbuseWords()) {
        const term = normalizeText(raw);
        if (!term) continue;
        const rx = new RegExp(`(?:^|\\s)${escapeRegex(term)}(?:$|\\s)`, "i");
        if (rx.test(normalized)) {
            return { hit: true, term };
        }
    }

    return { hit: false };
}

export type { ModerationHit };
