-- Phase 1 schema: Projects, Requirements, Test Plans/Scenarios/Cases, AI logs
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run

-- ===== Projects =====
create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

create policy "Users manage their own projects"
  on projects for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ===== Requirements =====
create table requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  source_type text not null check (source_type in ('text','pdf','docx','user_story')),
  raw_content text not null,
  parsed_content text,
  created_at timestamptz not null default now()
);

alter table requirements enable row level security;

create policy "Users manage requirements in their own projects"
  on requirements for all
  using (project_id in (select id from projects where owner_id = auth.uid()))
  with check (project_id in (select id from projects where owner_id = auth.uid()));

-- ===== Test Plans =====
create table test_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  requirement_id uuid references requirements(id) on delete set null,
  content_json jsonb not null,
  version int not null default 1,
  status text not null default 'draft' check (status in ('draft','approved')),
  created_at timestamptz not null default now()
);

alter table test_plans enable row level security;

create policy "Users manage test plans in their own projects"
  on test_plans for all
  using (project_id in (select id from projects where owner_id = auth.uid()))
  with check (project_id in (select id from projects where owner_id = auth.uid()));

-- ===== Test Scenarios =====
create table test_scenarios (
  id uuid primary key default gen_random_uuid(),
  test_plan_id uuid not null references test_plans(id) on delete cascade,
  title text not null,
  description text,
  priority text default 'medium' check (priority in ('low','medium','high','critical')),
  created_at timestamptz not null default now()
);

alter table test_scenarios enable row level security;

create policy "Users manage scenarios via parent test plan"
  on test_scenarios for all
  using (test_plan_id in (
    select tp.id from test_plans tp
    join projects p on p.id = tp.project_id
    where p.owner_id = auth.uid()
  ))
  with check (test_plan_id in (
    select tp.id from test_plans tp
    join projects p on p.id = tp.project_id
    where p.owner_id = auth.uid()
  ));

-- ===== Test Cases =====
create table test_cases (
  id uuid primary key default gen_random_uuid(),
  test_scenario_id uuid not null references test_scenarios(id) on delete cascade,
  title text not null,
  preconditions text,
  steps_json jsonb not null default '[]',
  test_data text,
  expected_result text not null,
  priority text default 'medium' check (priority in ('low','medium','high','critical')),
  severity text default 'medium' check (severity in ('low','medium','high','critical')),
  test_type text default 'functional',
  status text default 'not_executed',
  ai_generated boolean default true,
  approved boolean default false,
  needs_verification boolean default false,
  version int default 1,
  created_at timestamptz not null default now()
);

alter table test_cases enable row level security;

create policy "Users manage test cases via parent scenario"
  on test_cases for all
  using (test_scenario_id in (
    select ts.id from test_scenarios ts
    join test_plans tp on tp.id = ts.test_plan_id
    join projects p on p.id = tp.project_id
    where p.owner_id = auth.uid()
  ))
  with check (test_scenario_id in (
    select ts.id from test_scenarios ts
    join test_plans tp on tp.id = ts.test_plan_id
    join projects p on p.id = tp.project_id
    where p.owner_id = auth.uid()
  ));

-- ===== AI Conversations (Copilot chat, Phase 1 basic version) =====
create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  messages_json jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table ai_conversations enable row level security;

create policy "Users manage their own AI conversations"
  on ai_conversations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== AI Usage Log =====
create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_type text not null,
  model_used text,
  tokens_used int,
  cost_estimate numeric(10,4),
  created_at timestamptz not null default now()
);

alter table ai_usage_log enable row level security;

create policy "Users view usage logs for their own projects"
  on ai_usage_log for select
  using (project_id in (select id from projects where owner_id = auth.uid()));

create policy "Service role inserts usage logs"
  on ai_usage_log for insert
  with check (true);

-- ===== Indexes =====
create index idx_requirements_project on requirements(project_id);
create index idx_test_plans_project on test_plans(project_id);
create index idx_scenarios_plan on test_scenarios(test_plan_id);
create index idx_cases_scenario on test_cases(test_scenario_id);
