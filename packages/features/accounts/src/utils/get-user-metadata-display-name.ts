type UserMetadataLike = Record<string, unknown> | null | undefined;

export function getUserMetadataDisplayName(user: object) {
  const metadata =
    'user_metadata' in user &&
    user.user_metadata &&
    typeof user.user_metadata === 'object'
      ? (user.user_metadata as UserMetadataLike)
      : {};
  const candidates = [
    (metadata as Record<string, unknown>).full_name,
    (metadata as Record<string, unknown>).name,
    (metadata as Record<string, unknown>).user_name,
    (metadata as Record<string, unknown>).preferred_username,
    [
      (metadata as Record<string, unknown>).given_name,
      (metadata as Record<string, unknown>).family_name,
    ]
      .filter(Boolean)
      .join(' '),
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }

    const trimmedCandidate = candidate.trim();

    if (trimmedCandidate) {
      return trimmedCandidate;
    }
  }

  return null;
}
