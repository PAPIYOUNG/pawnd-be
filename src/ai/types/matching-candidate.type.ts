export type MatchingCandidate = {
  postId: string;

  vectorSimilarity: number;

  featureScore: number;
  locationScore: number;
  dateScore: number;

  distanceKm: number | null;

  finalScore: number;
};
