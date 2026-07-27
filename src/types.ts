export type ActiveGame = {
  name: string;
  players: number;
};

export type ActiveGamesResponse = {
  error: boolean;
  message?: string;
  games?: ActiveGame[];
  total?: number;
};

export type InsigniaEvent = {
  id: number;
  game: string;
  title: string;
  description?: string;
  image?: string;
  startUtc: string;
  endUtc?: string;
  hasPrize?: boolean;
  prizeAmount?: number | null;
  isPaidEvent?: boolean;
  entryFeeSats?: number | null;
  tournamentStatus?: string;
  signupCount?: number;
};

export type EventsResponse = {
  error: boolean;
  message?: string;
  events?: InsigniaEvent[];
};

// Mirrors @decky/ui's EConnectivityTestResult, which isn't exported from the
// package root (only reachable via SteamClient's internal type tree).
export enum EConnectivityTestResult {
  Unknown,
  Connected,
  CaptivePortal,
  TimedOut,
  Failed,
  WifiDisabled,
  NoLAN,
}

export type MenuView = "menu" | "activeGames" | "events" | "settings";
