-- ============================================================
-- TORNEIO ESCADA EMTP 2026 — Schema inicial
-- ============================================================

-- Extensões
create extension if not exists "btree_gist";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum ('admin', 'team_captain');
create type tournament_status as enum ('draft', 'active', 'frozen', 'finished');
create type category_code as enum ('M3', 'M4', 'M5', 'F54', 'MX');
create type team_status as enum ('active', 'suspended', 'withdrawn');
create type challenge_status as enum (
  'negotiating',
  'scheduled',
  'result_pending',
  'disputed',
  'completed',
  'cancelled',
  'expired'
);
create type slot_status as enum ('free', 'proposed', 'reserved', 'closed', 'completed');
create type proposal_status as enum ('pending', 'countered', 'accepted', 'expired');
create type result_status as enum ('pending_validation', 'validated', 'rejected');
create type dispute_status as enum ('open', 'decided', 'rejected');

-- ============================================================
-- PROFILES
-- ============================================================

create table profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid references auth.users(id) on delete cascade unique,
  name          text not null,
  email         text not null unique,
  phone         text,
  role          user_role not null default 'team_captain',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- TOURNAMENTS
-- ============================================================

create table tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  season      text not null,
  status      tournament_status not null default 'draft',
  starts_at   date,
  ends_at     date,
  final_dates text, -- "18 e 19 de julho" livre para texto
  created_at  timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================

create table categories (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  code          category_code not null,
  name          text not null,
  sort_order    int not null default 0
);

-- ============================================================
-- TEAMS
-- ============================================================

create table teams (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  category_id     uuid not null references categories(id) on delete cascade,
  name            text not null,
  captain_profile_id uuid references profiles(id) on delete set null,
  -- dados de inscrição (regulamento art. 3.3)
  player1_name    text not null,
  player1_email   text not null,
  player1_phone   text,
  player1_nif     text,
  player1_dob     date,
  player1_address text,
  player2_name    text not null,
  player2_email   text not null,
  player2_phone   text,
  player2_nif     text,
  player2_dob     date,
  player2_address text,
  status          team_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- RANKINGS
-- Posição atual de cada equipa na sua categoria
-- ============================================================

create table rankings (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,
  position      int not null,
  updated_at    timestamptz not null default now(),
  unique (category_id, position),
  unique (category_id, team_id)
);

-- ============================================================
-- RANKING EVENTS — histórico auditável de cada mudança
-- ============================================================

create table ranking_events (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  challenge_id  uuid, -- FK adicionado depois (forward reference)
  team_id       uuid not null references teams(id) on delete cascade,
  old_position  int not null,
  new_position  int not null,
  reason        text not null,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- COURTS
-- ============================================================

create table courts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name          text not null,
  active        boolean not null default true
);

-- Campos reais do EMTP
-- (inseridos via seed)

-- ============================================================
-- CHALLENGES
-- ============================================================

create table challenges (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references tournaments(id) on delete cascade,
  category_id         uuid not null references categories(id) on delete cascade,
  challenger_team_id  uuid not null references teams(id) on delete cascade,
  challenged_team_id  uuid not null references teams(id) on delete cascade,
  status              challenge_status not null default 'negotiating',
  created_by          uuid not null references profiles(id) on delete restrict,
  created_at          timestamptz not null default now(),
  deadline_at         timestamptz not null default (now() + interval '8 days'),
  selected_slot_id    uuid, -- FK adicionado depois
  constraint no_self_challenge check (challenger_team_id <> challenged_team_id)
);

-- ============================================================
-- SCHEDULE SLOTS
-- ============================================================

create table schedule_slots (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  court_id      uuid not null references courts(id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        slot_status not null default 'free',
  challenge_id  uuid references challenges(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    court_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('reserved', 'proposed', 'closed'))
);

-- ============================================================
-- CHALLENGE PROPOSALS (negociação de horário)
-- ============================================================

create table challenge_proposals (
  id                   uuid primary key default gen_random_uuid(),
  challenge_id         uuid not null references challenges(id) on delete cascade,
  proposed_by_team_id  uuid not null references teams(id) on delete cascade,
  slot_id              uuid not null references schedule_slots(id) on delete cascade,
  status               proposal_status not null default 'pending',
  created_at           timestamptz not null default now()
);

-- ============================================================
-- CHALLENGE MESSAGES (chat)
-- ============================================================

create table challenge_messages (
  id                uuid primary key default gen_random_uuid(),
  challenge_id      uuid not null references challenges(id) on delete cascade,
  author_profile_id uuid not null references profiles(id) on delete restrict,
  message           text not null check (length(trim(message)) > 0),
  created_at        timestamptz not null default now()
);

-- ============================================================
-- MATCH RESULTS
-- ============================================================

create table match_results (
  id                    uuid primary key default gen_random_uuid(),
  challenge_id          uuid not null references challenges(id) on delete cascade unique,
  submitted_by_team_id  uuid not null references teams(id) on delete restrict,
  winner_team_id        uuid not null references teams(id) on delete restrict,
  status                result_status not null default 'pending_validation',
  validated_by_profile_id uuid references profiles(id) on delete set null,
  validated_at          timestamptz,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- MATCH SETS
-- ============================================================

create table match_sets (
  id               uuid primary key default gen_random_uuid(),
  match_result_id  uuid not null references match_results(id) on delete cascade,
  set_number       int not null check (set_number between 1 and 3),
  challenger_games int not null check (challenger_games >= 0),
  challenged_games int not null check (challenged_games >= 0),
  -- set 3 é super tie-break: valores até 10+ são permitidos
  unique (match_result_id, set_number)
);

-- ============================================================
-- DISPUTES
-- ============================================================

create table disputes (
  id                    uuid primary key default gen_random_uuid(),
  challenge_id          uuid not null references challenges(id) on delete cascade unique,
  opened_by_profile_id  uuid not null references profiles(id) on delete restrict,
  reason                text not null,
  status                dispute_status not null default 'open',
  winner_team_id        uuid references teams(id) on delete set null,
  decided_by_profile_id uuid references profiles(id) on delete set null,
  decided_at            timestamptz,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text not null,
  read_at     timestamptz,
  action_url  text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table audit_logs (
  id                uuid primary key default gen_random_uuid(),
  actor_profile_id  uuid references profiles(id) on delete set null,
  action            text not null,
  entity_type       text not null,
  entity_id         uuid,
  metadata          jsonb,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- INVITES — convites de acesso (invite-only)
-- ============================================================

create table invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  team_id     uuid references teams(id) on delete set null,
  role        user_role not null default 'team_captain',
  token       text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  used_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_by  uuid not null references profiles(id) on delete restrict,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- FORWARD REFERENCES (FKs adicionadas depois dos create tables)
-- ============================================================

alter table challenges
  add constraint fk_selected_slot
  foreign key (selected_slot_id) references schedule_slots(id) on delete set null;

alter table ranking_events
  add constraint fk_challenge
  foreign key (challenge_id) references challenges(id) on delete set null;

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_rankings_category on rankings(category_id, position);
create index idx_challenges_tournament on challenges(tournament_id, status);
create index idx_challenges_challenger on challenges(challenger_team_id);
create index idx_challenges_challenged on challenges(challenged_team_id);
create index idx_notifications_profile on notifications(profile_id, read_at);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_schedule_slots_court on schedule_slots(court_id, starts_at);
create index idx_invites_token on invites(token);
create index idx_invites_email on invites(email);

-- ============================================================
-- TRIGGERS — auto updated_at
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

create trigger trg_teams_updated_at
  before update on teams
  for each row execute procedure set_updated_at();

create trigger trg_rankings_updated_at
  before update on rankings
  for each row execute procedure set_updated_at();

-- ============================================================
-- TRIGGER — auto-create profile when user signs up
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  invite_record invites%rowtype;
begin
  -- Verifica se existe convite válido para este email
  select * into invite_record
  from invites
  where email = new.email
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  insert into profiles (auth_user_id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(invite_record.role, 'team_captain')
  );

  -- Marca convite como usado
  if invite_record.id is not null then
    update invites set used_at = now() where id = invite_record.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
