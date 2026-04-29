// Tipos gerados manualmente — podem ser substituídos por `supabase gen types`
// após o projeto estar ligado ao Supabase.

export type UserRole = 'admin' | 'team_captain'
export type TournamentStatus = 'draft' | 'active' | 'frozen' | 'finished'
export type CategoryCode = 'M3' | 'M4' | 'M5' | 'F54' | 'MX'
export type TeamStatus = 'active' | 'suspended' | 'withdrawn'
export type ChallengeStatus =
  | 'negotiating'
  | 'scheduled'
  | 'result_pending'
  | 'disputed'
  | 'completed'
  | 'cancelled'
  | 'expired'
export type SlotStatus = 'free' | 'proposed' | 'reserved' | 'closed' | 'completed'
export type ProposalStatus = 'pending' | 'countered' | 'accepted' | 'expired'
export type ResultStatus = 'pending_validation' | 'validated' | 'rejected'
export type DisputeStatus = 'open' | 'decided' | 'rejected'

export interface Profile {
  id: string
  auth_user_id: string
  name: string
  email: string
  phone: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Tournament {
  id: string
  name: string
  season: string
  status: TournamentStatus
  starts_at: string | null
  ends_at: string | null
  final_dates: string | null
  created_at: string
}

export interface Category {
  id: string
  tournament_id: string
  code: CategoryCode
  name: string
  sort_order: number
}

export interface Team {
  id: string
  tournament_id: string
  category_id: string
  name: string
  captain_profile_id: string | null
  player1_name: string
  player1_email: string
  player1_phone: string | null
  player1_nif: string | null
  player1_dob: string | null
  player1_address: string | null
  player2_name: string
  player2_email: string
  player2_phone: string | null
  player2_nif: string | null
  player2_dob: string | null
  player2_address: string | null
  status: TeamStatus
  created_at: string
  updated_at: string
}

export interface Ranking {
  id: string
  tournament_id: string
  category_id: string
  team_id: string
  position: number
  updated_at: string
}

export interface RankingEvent {
  id: string
  tournament_id: string
  category_id: string
  challenge_id: string | null
  team_id: string
  old_position: number
  new_position: number
  reason: string
  created_by: string | null
  created_at: string
}

export interface Court {
  id: string
  tournament_id: string
  name: string
  active: boolean
}

export interface ScheduleSlot {
  id: string
  tournament_id: string
  court_id: string
  starts_at: string
  ends_at: string
  status: SlotStatus
  challenge_id: string | null
  created_at: string
}

export interface Challenge {
  id: string
  tournament_id: string
  category_id: string
  challenger_team_id: string
  challenged_team_id: string
  status: ChallengeStatus
  created_by: string
  created_at: string
  deadline_at: string
  selected_slot_id: string | null
}

export interface ChallengeProposal {
  id: string
  challenge_id: string
  proposed_by_team_id: string
  slot_id: string
  status: ProposalStatus
  created_at: string
}

export interface ChallengeMessage {
  id: string
  challenge_id: string
  author_profile_id: string
  message: string
  created_at: string
}

export interface MatchResult {
  id: string
  challenge_id: string
  submitted_by_team_id: string
  winner_team_id: string
  status: ResultStatus
  validated_by_profile_id: string | null
  validated_at: string | null
  created_at: string
}

export interface MatchSet {
  id: string
  match_result_id: string
  set_number: number
  challenger_games: number
  challenged_games: number
}

export interface Dispute {
  id: string
  challenge_id: string
  opened_by_profile_id: string
  reason: string
  status: DisputeStatus
  winner_team_id: string | null
  decided_by_profile_id: string | null
  decided_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  profile_id: string
  type: string
  title: string
  body: string
  read_at: string | null
  action_url: string | null
  created_at: string
}

export interface Invite {
  id: string
  email: string
  team_id: string | null
  role: UserRole
  token: string
  used_at: string | null
  expires_at: string
  created_by: string
  created_at: string
}

// ============================================================
// View types (joins comuns)
// ============================================================

export interface RankingRow extends Ranking {
  team: Team
}

export interface ChallengeWithTeams extends Challenge {
  challenger_team: Team
  challenged_team: Team
  selected_slot?: ScheduleSlot | null
}

export interface ChallengeDetail extends ChallengeWithTeams {
  messages: (ChallengeMessage & { author: Profile })[]
  proposals: (ChallengeProposal & { slot: ScheduleSlot; court: Court })[]
  match_result?: (MatchResult & { sets: MatchSet[] }) | null
  dispute?: Dispute | null
}
