-- ============================================================
-- ROW LEVEL SECURITY — Torneio Escada EMTP 2026
-- ============================================================
-- Princípio: invite-only, dois roles (admin, team_captain)
-- Todas as tabelas têm RLS ativado.
-- ============================================================

-- Helper: retorna o profile do utilizador atual
create or replace function auth_profile_id()
returns uuid language sql stable security definer as $$
  select id from profiles where auth_user_id = auth.uid()
$$;

-- Helper: retorna o role do utilizador atual
create or replace function auth_role()
returns user_role language sql stable security definer as $$
  select role from profiles where auth_user_id = auth.uid()
$$;

-- Helper: retorna o team_id do capitão (numa categoria de torneio)
create or replace function auth_team_id(p_tournament_id uuid)
returns uuid language sql stable security definer as $$
  select t.id from teams t
  where t.captain_profile_id = auth_profile_id()
    and t.tournament_id = p_tournament_id
  limit 1
$$;

-- ============================================================
-- PROFILES
-- ============================================================

alter table profiles enable row level security;

-- Cada um vê o próprio perfil; admin vê todos
create policy "profiles_select" on profiles for select using (
  auth_user_id = auth.uid() or auth_role() = 'admin'
);

-- Só o próprio pode atualizar (nome, telefone)
create policy "profiles_update" on profiles for update using (
  auth_user_id = auth.uid()
) with check (
  auth_user_id = auth.uid()
);

-- Insert feito pelo trigger handle_new_user (security definer) — sem policy necessária
-- Admin pode criar perfis diretamente se necessário
create policy "profiles_insert_admin" on profiles for insert with check (
  auth_role() = 'admin'
);

-- ============================================================
-- TOURNAMENTS
-- ============================================================

alter table tournaments enable row level security;

create policy "tournaments_select" on tournaments for select using (true);

create policy "tournaments_insert" on tournaments for insert with check (
  auth_role() = 'admin'
);

create policy "tournaments_update" on tournaments for update using (
  auth_role() = 'admin'
);

-- ============================================================
-- CATEGORIES
-- ============================================================

alter table categories enable row level security;

create policy "categories_select" on categories for select using (true);

create policy "categories_write" on categories for all using (
  auth_role() = 'admin'
);

-- ============================================================
-- TEAMS
-- ============================================================

alter table teams enable row level security;

-- Todos vêem equipas ativas (ranking público dentro da app)
create policy "teams_select" on teams for select using (
  status = 'active'
  or auth_role() = 'admin'
  or captain_profile_id = auth_profile_id()
);

create policy "teams_insert" on teams for insert with check (
  auth_role() = 'admin'
);

create policy "teams_update" on teams for update using (
  auth_role() = 'admin'
  or captain_profile_id = auth_profile_id()
) with check (
  -- capitão só pode atualizar campos de contacto, não status nem posição
  auth_role() = 'admin'
  or (captain_profile_id = auth_profile_id() and status = 'active')
);

-- ============================================================
-- RANKINGS
-- ============================================================

alter table rankings enable row level security;

create policy "rankings_select" on rankings for select using (true);

-- Só admin escreve ranking (atualizações feitas via Server Action com service role)
create policy "rankings_write" on rankings for all using (
  auth_role() = 'admin'
);

-- ============================================================
-- RANKING EVENTS
-- ============================================================

alter table ranking_events enable row level security;

create policy "ranking_events_select" on ranking_events for select using (
  auth_role() = 'admin'
  or team_id in (
    select id from teams where captain_profile_id = auth_profile_id()
  )
);

-- Escrita via service role (Server Action)
create policy "ranking_events_insert" on ranking_events for insert with check (
  auth_role() = 'admin'
);

-- ============================================================
-- COURTS
-- ============================================================

alter table courts enable row level security;

create policy "courts_select" on courts for select using (true);

create policy "courts_write" on courts for all using (
  auth_role() = 'admin'
);

-- ============================================================
-- SCHEDULE SLOTS
-- ============================================================

alter table schedule_slots enable row level security;

create policy "slots_select" on schedule_slots for select using (true);

-- Admin cria slots livres
create policy "slots_insert_admin" on schedule_slots for insert with check (
  auth_role() = 'admin'
);

-- Sistema (service role) atualiza status dos slots
create policy "slots_update_admin" on schedule_slots for update using (
  auth_role() = 'admin'
);

-- ============================================================
-- CHALLENGES
-- ============================================================

alter table challenges enable row level security;

-- Cada capitão vê os seus desafios; admin vê todos
create policy "challenges_select" on challenges for select using (
  auth_role() = 'admin'
  or challenger_team_id in (
    select id from teams where captain_profile_id = auth_profile_id()
  )
  or challenged_team_id in (
    select id from teams where captain_profile_id = auth_profile_id()
  )
);

-- Capitão cria desafios (validação de elegibilidade feita no Server Action)
create policy "challenges_insert" on challenges for insert with check (
  auth_role() = 'admin'
  or challenger_team_id in (
    select id from teams where captain_profile_id = auth_profile_id() and status = 'active'
  )
);

-- Atualizações de status feitas via service role no Server Action
create policy "challenges_update" on challenges for update using (
  auth_role() = 'admin'
  or challenger_team_id in (
    select id from teams where captain_profile_id = auth_profile_id()
  )
  or challenged_team_id in (
    select id from teams where captain_profile_id = auth_profile_id()
  )
);

-- ============================================================
-- CHALLENGE PROPOSALS
-- ============================================================

alter table challenge_proposals enable row level security;

create policy "proposals_select" on challenge_proposals for select using (
  auth_role() = 'admin'
  or challenge_id in (
    select id from challenges
    where challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
       or challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
  )
);

create policy "proposals_insert" on challenge_proposals for insert with check (
  auth_role() = 'admin'
  or proposed_by_team_id in (
    select id from teams where captain_profile_id = auth_profile_id() and status = 'active'
  )
);

create policy "proposals_update" on challenge_proposals for update using (
  auth_role() = 'admin'
);

-- ============================================================
-- CHALLENGE MESSAGES
-- ============================================================

alter table challenge_messages enable row level security;

create policy "messages_select" on challenge_messages for select using (
  auth_role() = 'admin'
  or challenge_id in (
    select id from challenges
    where challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
       or challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
  )
);

create policy "messages_insert" on challenge_messages for insert with check (
  author_profile_id = auth_profile_id()
  and (
    auth_role() = 'admin'
    or challenge_id in (
      select id from challenges
      where challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
         or challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
    )
  )
);

-- ============================================================
-- MATCH RESULTS
-- ============================================================

alter table match_results enable row level security;

create policy "results_select" on match_results for select using (
  auth_role() = 'admin'
  or challenge_id in (
    select id from challenges
    where challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
       or challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
  )
);

-- Submissão por uma das duplas envolvidas
create policy "results_insert" on match_results for insert with check (
  auth_role() = 'admin'
  or submitted_by_team_id in (
    select id from teams where captain_profile_id = auth_profile_id()
  )
);

-- Validação/rejeição feita via service role no Server Action
create policy "results_update" on match_results for update using (
  auth_role() = 'admin'
);

-- ============================================================
-- MATCH SETS
-- ============================================================

alter table match_sets enable row level security;

create policy "sets_select" on match_sets for select using (
  auth_role() = 'admin'
  or match_result_id in (
    select mr.id from match_results mr
    join challenges c on c.id = mr.challenge_id
    where c.challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
       or c.challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
  )
);

create policy "sets_insert" on match_sets for insert with check (
  auth_role() = 'admin'
  or match_result_id in (
    select mr.id from match_results mr
    join challenges c on c.id = mr.challenge_id
    where c.challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
       or c.challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
  )
);

-- ============================================================
-- DISPUTES
-- ============================================================

alter table disputes enable row level security;

create policy "disputes_select" on disputes for select using (
  auth_role() = 'admin'
  or challenge_id in (
    select id from challenges
    where challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
       or challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
  )
);

create policy "disputes_insert" on disputes for insert with check (
  opened_by_profile_id = auth_profile_id()
  and challenge_id in (
    select id from challenges
    where challenger_team_id in (select id from teams where captain_profile_id = auth_profile_id())
       or challenged_team_id in (select id from teams where captain_profile_id = auth_profile_id())
  )
);

create policy "disputes_update" on disputes for update using (
  auth_role() = 'admin'
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

alter table notifications enable row level security;

-- Cada utilizador só vê as suas
create policy "notifications_select" on notifications for select using (
  profile_id = auth_profile_id()
);

-- Escrita feita pelo sistema (service role)
create policy "notifications_insert" on notifications for insert with check (
  auth_role() = 'admin'
);

-- Marcar como lida
create policy "notifications_update" on notifications for update using (
  profile_id = auth_profile_id()
) with check (
  profile_id = auth_profile_id()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

alter table audit_logs enable row level security;

create policy "audit_select" on audit_logs for select using (
  auth_role() = 'admin'
);

create policy "audit_insert" on audit_logs for insert with check (
  auth_role() = 'admin'
);

-- ============================================================
-- INVITES
-- ============================================================

alter table invites enable row level security;

create policy "invites_select" on invites for select using (
  auth_role() = 'admin'
  or email = (select email from profiles where id = auth_profile_id())
);

create policy "invites_insert" on invites for insert with check (
  auth_role() = 'admin'
);

create policy "invites_update" on invites for update using (
  auth_role() = 'admin'
);
