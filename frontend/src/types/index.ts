export interface User {
  id: number;
  nickname: string;
  email: string;
  avatarUrl: string | null;
  isTwoFactorEnabled: boolean;
  statusId: number;
  status: Status;
  wins: number;
  losses: number;
  rank: number;
  level: number;
  createdAt: string;
  updatedAt: string;
}

export interface Status {
  id: number;
  name: string;
  entityType: string;
}

export interface Game {
  id: number;
  tournamentId: number | null;
  gameTypeId: number;
  statusId: number;
  status: Status;
  createdAt: string;
  updatedAt: string;
  players: PlayerScore[];
}

export interface PlayerScore {
  id: number;
  gameId: number;
  userId: number;
  user: Pick<User, 'id' | 'nickname' | 'avatarUrl'>;
  score: number;
  isWinner: boolean;
}

export interface MatchHistoryEntry {
  id: number;
  date: string;
  opponent: Pick<User, 'id' | 'nickname' | 'avatarUrl'>;
  myScore: number;
  opponentScore: number;
  result: 'win' | 'loss';
}

export interface RankingEntry {
  rank: number;
  user: Pick<User, 'id' | 'nickname' | 'avatarUrl'>;
  wins: number;
  losses: number;
  winRate: number;
  level: number;
}

export interface Tournament {
  id: number;
  name: string;
  statusId: number;
  status: Status;
  participants: User[];
  games: Game[];
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

export type OnlineStatus = 'online' | 'offline' | 'in-game';

export interface Friend {
  id: number;
  user: Pick<User, 'id' | 'nickname' | 'avatarUrl'>;
  onlineStatus: OnlineStatus;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}
