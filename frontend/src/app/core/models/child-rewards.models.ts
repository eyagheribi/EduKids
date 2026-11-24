/** Future contract for a parent-defined child star goal and promised reward. */
export interface ChildStarRewardGoal {
  readonly id: string;
  readonly spaceId: string;
  readonly targetStars: number;
  readonly earnedStars: number;
  readonly promisedReward: string;
  readonly updatedAt: string | null;
}

/** Future contract for an achievement badge earned by a child. */
export interface ChildAchievementBadge {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly unlockedAt: string | null;
  readonly progress: number | null;
  readonly target: number | null;
}
