export type RankField = 'leagueRank' | 'conferenceRank' | 'divisionRank' | 'wildcardRank';

export const RANK_LABELS: Record<RankField, string> = {
  wildcardRank:   'Wild Card',
  divisionRank:   'Division',
  conferenceRank: 'Conference',
  leagueRank:     'League',
};
