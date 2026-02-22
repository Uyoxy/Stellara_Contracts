export enum ReputationAction {
  POST_CREATED = 'POST_CREATED',
  POST_UPVOTED = 'POST_UPVOTED',
  POST_DOWNVOTED = 'POST_DOWNVOTED',
  COMMENT_CREATED = 'COMMENT_CREATED',
  COMMENT_UPVOTED = 'COMMENT_UPVOTED',
  COURSE_COMPLETED = 'COURSE_COMPLETED',
  QUIZ_PASSED = 'QUIZ_PASSED',
  QUIZ_PERFECT_SCORE = 'QUIZ_PERFECT_SCORE',
  ANSWER_ACCEPTED = 'ANSWER_ACCEPTED',
  HELPFUL_ANSWER = 'HELPFUL_ANSWER',
  QUESTION_ASKED = 'QUESTION_ASKED',
  PROFILE_COMPLETED = 'PROFILE_COMPLETED',
  DAILY_LOGIN = 'DAILY_LOGIN',
  STREAK_MILESTONE = 'STREAK_MILESTONE',
  REPORT_VALIDATED = 'REPORT_VALIDATED',
  CONTENT_REMOVED = 'CONTENT_REMOVED',
  SPAM_PENALTY = 'SPAM_PENALTY',
}

export enum UserRank {
  NEWCOMER = 'NEWCOMER',
  MEMBER = 'MEMBER',
  CONTRIBUTOR = 'CONTRIBUTOR',
  TRUSTED = 'TRUSTED',
  EXPERT = 'EXPERT',
  LEGEND = 'LEGEND',
}

export enum AchievementCategory {
  CONTENT = 'CONTENT',
  LEARNING = 'LEARNING',
  SOCIAL = 'SOCIAL',
  COMMUNITY = 'COMMUNITY',
  STREAK = 'STREAK',
  SPECIAL = 'SPECIAL',
}

export enum AchievementTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

export enum BadgeType {
  ROLE = 'ROLE',
  ACHIEVEMENT = 'ACHIEVEMENT',
  SPECIAL = 'SPECIAL',
  VERIFIED = 'VERIFIED',
}

export const REPUTATION_POINTS: Record<ReputationAction, number> = {
  [ReputationAction.POST_CREATED]: 10,
  [ReputationAction.POST_UPVOTED]: 5,
  [ReputationAction.POST_DOWNVOTED]: -2,
  [ReputationAction.COMMENT_CREATED]: 3,
  [ReputationAction.COMMENT_UPVOTED]: 2,
  [ReputationAction.COURSE_COMPLETED]: 50,
  [ReputationAction.QUIZ_PASSED]: 15,
  [ReputationAction.QUIZ_PERFECT_SCORE]: 30,
  [ReputationAction.ANSWER_ACCEPTED]: 25,
  [ReputationAction.HELPFUL_ANSWER]: 10,
  [ReputationAction.QUESTION_ASKED]: 5,
  [ReputationAction.PROFILE_COMPLETED]: 20,
  [ReputationAction.DAILY_LOGIN]: 2,
  [ReputationAction.STREAK_MILESTONE]: 15,
  [ReputationAction.REPORT_VALIDATED]: 5,
  [ReputationAction.CONTENT_REMOVED]: -10,
  [ReputationAction.SPAM_PENALTY]: -25,
};

export const XP_POINTS: Record<ReputationAction, number> = {
  [ReputationAction.POST_CREATED]: 20,
  [ReputationAction.POST_UPVOTED]: 10,
  [ReputationAction.POST_DOWNVOTED]: 0,
  [ReputationAction.COMMENT_CREATED]: 8,
  [ReputationAction.COMMENT_UPVOTED]: 5,
  [ReputationAction.COURSE_COMPLETED]: 100,
  [ReputationAction.QUIZ_PASSED]: 30,
  [ReputationAction.QUIZ_PERFECT_SCORE]: 60,
  [ReputationAction.ANSWER_ACCEPTED]: 50,
  [ReputationAction.HELPFUL_ANSWER]: 20,
  [ReputationAction.QUESTION_ASKED]: 10,
  [ReputationAction.PROFILE_COMPLETED]: 30,
  [ReputationAction.DAILY_LOGIN]: 5,
  [ReputationAction.STREAK_MILESTONE]: 25,
  [ReputationAction.REPORT_VALIDATED]: 10,
  [ReputationAction.CONTENT_REMOVED]: 0,
  [ReputationAction.SPAM_PENALTY]: 0,
};

export const RANK_THRESHOLDS: Record<UserRank, number> = {
  [UserRank.NEWCOMER]: 0,
  [UserRank.MEMBER]: 100,
  [UserRank.CONTRIBUTOR]: 500,
  [UserRank.TRUSTED]: 1500,
  [UserRank.EXPERT]: 5000,
  [UserRank.LEGEND]: 15000,
};

export function xpForLevel(level: number): number {
  return Math.floor(100 * (level - 1) * (1 + (level - 1) * 0.05));
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

export function rankFromReputation(rep: number): UserRank {
  const ranks = Object.entries(RANK_THRESHOLDS).sort(([, a], [, b]) => b - a);
  for (const [rank, threshold] of ranks) {
    if (rep >= threshold) return rank as UserRank;
  }
  return UserRank.NEWCOMER;
}
