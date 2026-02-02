// Firestore document types matching your database structure

export type AppRole = 'admin' | 'player' | 'user';
export type PlayerPosition = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
export type LineupType = 'first_half' | 'second_half' | 'full_time';
export type MatchStatus = 'upcoming' | 'completed';
export type EventType = 'goal' | 'assist' | 'yellow_card' | 'red_card';

export interface Profile {
  id?: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id?: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Player {
  id?: string;
  full_name: string;
  position: PlayerPosition;
  jersey_number: number;
  email?: string | null;
  avatar_url?: string | null;
  image_public_id?: string | null;
  user_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Competition {
  id?: string;
  name: string;
  season?: string | null;
  created_at: string;
}

export interface KitColor {
  id?: string;
  name: string;
  primary_color: string;
  secondary_color?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Match {
  id?: string;
  opponent: string;
  match_date: string;
  stadium?: string | null;
  status: MatchStatus;
  goals_scored?: number | null;
  goals_conceded?: number | null;
  points_earned?: number | null;
  competition_id?: string | null;
  kit_color?: string | null; // Changed from kit_color_id to kit_color (string)
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

// Enriched Match with joined data
export interface MatchWithDetails extends Match {
  competitions?: Competition | null;
}

export interface MatchLineup {
  id?: string;
  match_id: string;
  player_id: string;
  lineup_type: LineupType;
  position_played: PlayerPosition;
  created_at: string;
}

export interface MatchLineupWithPlayer extends MatchLineup {
  players?: Player | null;
}

export interface MatchEvent {
  id?: string;
  match_id: string;
  player_id: string;
  event_type: EventType;
  minute?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface MatchEventWithPlayer extends MatchEvent {
  players?: Player | null;
}

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  image_url?: string | null;
  image_public_id?: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface GalleryItem {
  id?: string;
  title?: string | null;
  image_url: string;
  image_public_id?: string | null;
  match_id?: string | null;
  is_visible: boolean;
  created_at: string;
}

// Constants for enums
export const Constants = {
  app_role: ['admin', 'player', 'user'] as const,
  lineup_type: ['first_half', 'second_half', 'full_time'] as const,
  player_position: ['goalkeeper', 'defender', 'midfielder', 'forward'] as const,
};
