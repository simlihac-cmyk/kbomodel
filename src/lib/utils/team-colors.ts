type TeamPalette = {
  primaryColor: string;
  secondaryColor: string;
};

function normalizeHexColor(color: string): string | null {
  const trimmed = color.trim();
  if (!/^#([\da-f]{3}|[\da-f]{6})$/i.test(trimmed)) {
    return null;
  }

  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return trimmed.toLowerCase();
}

function hexToRgb(color: string): [number, number, number] | null {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return null;
  }

  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function colorDistance(left: string, right: string): number {
  const leftRgb = hexToRgb(left);
  const rightRgb = hexToRgb(right);

  if (!leftRgb || !rightRgb) {
    return 0;
  }

  const [leftR, leftG, leftB] = leftRgb;
  const [rightR, rightG, rightB] = rightRgb;
  return Math.sqrt(
    (leftR - rightR) ** 2 +
      (leftG - rightG) ** 2 +
      (leftB - rightB) ** 2,
  );
}

function buildCandidates(team: TeamPalette): string[] {
  const seen = new Set<string>();
  const candidates = [team.primaryColor, team.secondaryColor]
    .map(normalizeHexColor)
    .filter((color): color is string => color !== null)
    .filter((color) => {
      if (seen.has(color)) {
        return false;
      }
      seen.add(color);
      return true;
    });

  return candidates.length > 0 ? candidates : [team.primaryColor];
}

export function resolveDistinctTeamColors(left: TeamPalette, right: TeamPalette) {
  const leftPrimary = normalizeHexColor(left.primaryColor) ?? left.primaryColor;
  const rightPrimary = normalizeHexColor(right.primaryColor) ?? right.primaryColor;
  const leftCandidates = buildCandidates(left);
  const rightCandidates = buildCandidates(right);

  let bestLeftColor = leftPrimary;
  let bestRightColor = rightPrimary;
  let bestScore = -1;

  for (const leftColor of leftCandidates) {
    for (const rightColor of rightCandidates) {
      let score = colorDistance(leftColor, rightColor);

      if (leftColor === leftPrimary) {
        score += 24;
      }
      if (rightColor === rightPrimary) {
        score += 24;
      }

      if (score > bestScore) {
        bestScore = score;
        bestLeftColor = leftColor;
        bestRightColor = rightColor;
      }
    }
  }

  return {
    leftColor: bestLeftColor,
    rightColor: bestRightColor,
  };
}
