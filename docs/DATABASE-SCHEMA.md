# Database Schema Documentation

## Overview

Abduloei uses **Supabase (PostgreSQL)** with Row Level Security (RLS) for multi-home data isolation. The database is designed to support:
- Multiple homes per user
- Role-based access (Owner/Admin/Member)
- Invitation system
- LINE notifications
- Thai language content

## Database Diagram

```
┌─────────────┐
│ auth.users  │ (Supabase Auth)
└──────┬──────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐  ┌──────────────┐
│  profiles   │  │    homes     │
└─────────────┘  └──────┬───────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
┌──────────────┐  ┌──────────┐   ┌─────────────┐
│ home_members │  │  events  │   │    tasks    │
└──────────────┘  └──────────┘   └─────────────┘
       │                              │
       │          ┌──────────┐        │
       │          │  notes   │        │
       │          └──────────┘        │
       │                              │
       ▼                              ▼
┌──────────────────┐         ┌────────────────┐
│  invitations     │         │ notification_  │
└──────────────────┘         │   settings     │
                             └────────────────┘
       │
       ▼
┌──────────────────┐
│ line_connections │
└──────────────────┘
```

## Core Tables

### 1. profiles

User profile information extending Supabase Auth.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_profiles_email on profiles(email);

-- RLS Policies
alter table profiles enable row level security;

create policy "Users can view their own profile"
on profiles for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on profiles for update
using (auth.uid() = id);

create policy "Users can insert their own profile"
on profiles for insert
with check (auth.uid() = id);

-- Trigger to auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger to update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
```

### 2. homes

Represents a home (household) that multiple users can belong to.

```sql
create table homes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_homes_created_by on homes(created_by);

-- RLS Policies
alter table homes enable row level security;

create policy "Users can view homes they are members of"
on homes for select
using (
  exists (
    select 1 from home_members
    where home_members.home_id = homes.id
    and home_members.user_id = auth.uid()
  )
);

create policy "Users can insert homes"
on homes for insert
with check (auth.uid() = created_by);

create policy "Only owners and admins can update homes"
on homes for update
using (
  exists (
    select 1 from home_members
    where home_members.home_id = homes.id
    and home_members.user_id = auth.uid()
    and home_members.role in ('owner', 'admin')
  )
);

create policy "Only owners can delete homes"
on homes for delete
using (
  exists (
    select 1 from home_members
    where home_members.home_id = homes.id
    and home_members.user_id = auth.uid()
    and home_members.role = 'owner'
  )
);

-- Trigger to update updated_at
create trigger homes_updated_at
  before update on homes
  for each row execute function update_updated_at();
```

### 3. home_members

Junction table linking users to homes with roles.

```sql
create type home_role as enum ('owner', 'admin', 'member');

create table home_members (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references homes(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role home_role default 'member' not null,
  joined_at timestamp with time zone default now(),

  -- Ensure user can only be a member once per home
  unique(home_id, user_id)
);

-- Indexes
create index idx_home_members_home_id on home_members(home_id);
create index idx_home_members_user_id on home_members(user_id);
create index idx_home_members_role on home_members(role);

-- RLS Policies
alter table home_members enable row level security;

create policy "Users can view members of their homes"
on home_members for select
using (
  exists (
    select 1 from home_members hm
    where hm.home_id = home_members.home_id
    and hm.user_id = auth.uid()
  )
);

create policy "Only owners and admins can insert members"
on home_members for insert
with check (
  exists (
    select 1 from home_members hm
    where hm.home_id = home_members.home_id
    and hm.user_id = auth.uid()
    and hm.role in ('owner', 'admin')
  )
);

create policy "Only owners and admins can update member roles"
on home_members for update
using (
  exists (
    select 1 from home_members hm
    where hm.home_id = home_members.home_id
    and hm.user_id = auth.uid()
    and hm.role in ('owner', 'admin')
  )
);

create policy "Members can remove themselves, owners/admins can remove others"
on home_members for delete
using (
  home_members.user_id = auth.uid()
  or exists (
    select 1 from home_members hm
    where hm.home_id = home_members.home_id
    and hm.user_id = auth.uid()
    and hm.role in ('owner', 'admin')
  )
);

-- Trigger to auto-add creator as owner when home is created
create or replace function add_home_owner()
returns trigger as $$
begin
  insert into home_members (home_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_home_created
  after insert on homes
  for each row execute function add_home_owner();

-- Trigger to prevent removing last owner
create or replace function prevent_last_owner_removal()
returns trigger as $$
declare
  owner_count integer;
begin
  if old.role = 'owner' then
    select count(*) into owner_count
    from home_members
    where home_id = old.home_id
    and role = 'owner'
    and id != old.id;

    if owner_count = 0 then
      raise exception 'Cannot remove the last owner of a home';
    end if;
  end if;
  return old;
end;
$$ language plpgsql;

create trigger prevent_last_owner_removal
  before delete on home_members
  for each row execute function prevent_last_owner_removal();
```

### 4. events

Calendar events for homes.

```sql
create table events (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references homes(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,

  title text not null,
  description text,
  date date not null,
  time time,

  -- Optional: assign event to specific member
  for_member uuid references auth.users(id) on delete set null,

  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_events_home_id on events(home_id);
create index idx_events_date on events(date);
create index idx_events_created_by on events(created_by);
create index idx_events_for_member on events(for_member);
create index idx_events_home_date on events(home_id, date);

-- RLS Policies
alter table events enable row level security;

create policy "Users can view events in their homes"
on events for select
using (
  exists (
    select 1 from home_members
    where home_members.home_id = events.home_id
    and home_members.user_id = auth.uid()
  )
);

create policy "Users can create events in their homes"
on events for insert
with check (
  exists (
    select 1 from home_members
    where home_members.home_id = events.home_id
    and home_members.user_id = auth.uid()
  )
  and created_by = auth.uid()
);

create policy "Users can update events they created"
on events for update
using (created_by = auth.uid());

create policy "Users can delete events they created or admins can delete any"
on events for delete
using (
  created_by = auth.uid()
  or exists (
    select 1 from home_members
    where home_members.home_id = events.home_id
    and home_members.user_id = auth.uid()
    and home_members.role in ('owner', 'admin')
  )
);

-- Trigger to update updated_at
create trigger events_updated_at
  before update on events
  for each row execute function update_updated_at();
```

### 5. tasks

To-do tasks for homes.

```sql
create type task_status as enum ('pending', 'completed', 'cancelled');

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references homes(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,

  title text not null,
  description text,
  status task_status default 'pending' not null,
  due_date date,

  -- Optional: assign task to specific member
  assigned_to uuid references auth.users(id) on delete set null,

  -- Completion info
  completed_at timestamp with time zone,
  completed_by uuid references auth.users(id) on delete set null,

  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_tasks_home_id on tasks(home_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_assigned_to on tasks(assigned_to);
create index idx_tasks_home_status on tasks(home_id, status);

-- RLS Policies
alter table tasks enable row level security;

create policy "Users can view tasks in their homes"
on tasks for select
using (
  exists (
    select 1 from home_members
    where home_members.home_id = tasks.home_id
    and home_members.user_id = auth.uid()
  )
);

create policy "Users can create tasks in their homes"
on tasks for insert
with check (
  exists (
    select 1 from home_members
    where home_members.home_id = tasks.home_id
    and home_members.user_id = auth.uid()
  )
  and created_by = auth.uid()
);

create policy "Users can update tasks in their homes"
on tasks for update
using (
  exists (
    select 1 from home_members
    where home_members.home_id = tasks.home_id
    and home_members.user_id = auth.uid()
  )
);

create policy "Users can delete tasks they created or admins can delete any"
on tasks for delete
using (
  created_by = auth.uid()
  or exists (
    select 1 from home_members
    where home_members.home_id = tasks.home_id
    and home_members.user_id = auth.uid()
    and home_members.role in ('owner', 'admin')
  )
);

-- Trigger to update updated_at
create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- Trigger to set completed_at and completed_by when status changes to completed
create or replace function set_task_completion()
returns trigger as $$
begin
  if new.status = 'completed' and old.status != 'completed' then
    new.completed_at = now();
    new.completed_by = auth.uid();
  elsif new.status != 'completed' and old.status = 'completed' then
    new.completed_at = null;
    new.completed_by = null;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger task_completion
  before update on tasks
  for each row execute function set_task_completion();
```

### 6. notes

Quick notes/memos for homes.

```sql
create table notes (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references homes(id) on delete cascade not null,
  created_by uuid references auth.users(id) on delete set null,

  title text,
  content text not null,

  -- Metadata
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_notes_home_id on notes(home_id);
create index idx_notes_created_by on notes(created_by);
create index idx_notes_created_at on notes(created_at desc);

-- Full-text search index for Thai content
create index idx_notes_content_search on notes using gin(to_tsvector('thai', content));

-- RLS Policies
alter table notes enable row level security;

create policy "Users can view notes in their homes"
on notes for select
using (
  exists (
    select 1 from home_members
    where home_members.home_id = notes.home_id
    and home_members.user_id = auth.uid()
  )
);

create policy "Users can create notes in their homes"
on notes for insert
with check (
  exists (
    select 1 from home_members
    where home_members.home_id = notes.home_id
    and home_members.user_id = auth.uid()
  )
  and created_by = auth.uid()
);

create policy "Users can update notes they created"
on notes for update
using (created_by = auth.uid());

create policy "Users can delete notes they created or admins can delete any"
on notes for delete
using (
  created_by = auth.uid()
  or exists (
    select 1 from home_members
    where home_members.home_id = notes.home_id
    and home_members.user_id = auth.uid()
    and home_members.role in ('owner', 'admin')
  )
);

-- Trigger to update updated_at
create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at();
```

## Invitation System

### 7. invitations

Invitations to join homes.

```sql
create type invitation_status as enum ('pending', 'accepted', 'declined', 'expired');

create table invitations (
  id uuid primary key default uuid_generate_v4(),
  home_id uuid references homes(id) on delete cascade not null,
  invited_by uuid references auth.users(id) on delete set null not null,

  email text not null,
  role home_role default 'member' not null,
  token text unique not null default encode(gen_random_bytes(32), 'hex'),

  status invitation_status default 'pending' not null,
  expires_at timestamp with time zone default (now() + interval '7 days') not null,

  accepted_at timestamp with time zone,
  accepted_by uuid references auth.users(id) on delete set null,

  created_at timestamp with time zone default now()
);

-- Indexes
create index idx_invitations_home_id on invitations(home_id);
create index idx_invitations_email on invitations(email);
create index idx_invitations_token on invitations(token);
create index idx_invitations_status on invitations(status);

-- RLS Policies
alter table invitations enable row level security;

create policy "Users can view invitations for their homes"
on invitations for select
using (
  exists (
    select 1 from home_members
    where home_members.home_id = invitations.home_id
    and home_members.user_id = auth.uid()
    and home_members.role in ('owner', 'admin')
  )
);

create policy "Users can view invitations sent to their email"
on invitations for select
using (
  email = (select email from auth.users where id = auth.uid())
);

create policy "Owners and admins can create invitations"
on invitations for insert
with check (
  exists (
    select 1 from home_members
    where home_members.home_id = invitations.home_id
    and home_members.user_id = auth.uid()
    and home_members.role in ('owner', 'admin')
  )
  and invited_by = auth.uid()
);

create policy "Invited users can update invitations (accept/decline)"
on invitations for update
using (
  email = (select email from auth.users where id = auth.uid())
  and status = 'pending'
);

create policy "Owners and admins can delete pending invitations"
on invitations for delete
using (
  exists (
    select 1 from home_members
    where home_members.home_id = invitations.home_id
    and home_members.user_id = auth.uid()
    and home_members.role in ('owner', 'admin')
  )
  and status = 'pending'
);

-- Function to accept invitation
create or replace function accept_invitation(invitation_token text)
returns json as $$
declare
  inv record;
  new_member_id uuid;
begin
  -- Get invitation
  select * into inv
  from invitations
  where token = invitation_token
  and status = 'pending'
  and expires_at > now()
  and email = (select email from auth.users where id = auth.uid());

  if not found then
    return json_build_object('success', false, 'error', 'Invalid or expired invitation');
  end if;

  -- Check if already a member
  if exists (
    select 1 from home_members
    where home_id = inv.home_id
    and user_id = auth.uid()
  ) then
    return json_build_object('success', false, 'error', 'Already a member');
  end if;

  -- Add user to home
  insert into home_members (home_id, user_id, role)
  values (inv.home_id, auth.uid(), inv.role)
  returning id into new_member_id;

  -- Update invitation status
  update invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = auth.uid()
  where id = inv.id;

  return json_build_object(
    'success', true,
    'home_id', inv.home_id,
    'member_id', new_member_id
  );
end;
$$ language plpgsql security definer;

-- Function to decline invitation
create or replace function decline_invitation(invitation_token text)
returns json as $$
declare
  inv record;
begin
  -- Get invitation
  select * into inv
  from invitations
  where token = invitation_token
  and status = 'pending'
  and email = (select email from auth.users where id = auth.uid());

  if not found then
    return json_build_object('success', false, 'error', 'Invalid invitation');
  end if;

  -- Update invitation status
  update invitations
  set status = 'declined'
  where id = inv.id;

  return json_build_object('success', true);
end;
$$ language plpgsql security definer;

-- Cron job function to expire old invitations (run daily)
create or replace function expire_old_invitations()
returns void as $$
begin
  update invitations
  set status = 'expired'
  where status = 'pending'
  and expires_at < now();
end;
$$ language plpgsql;
```

## LINE Integration

### 8. line_connections

Stores LINE account connections for notifications.

```sql
create table line_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique not null,

  line_user_id text unique not null,
  display_name text,
  picture_url text,
  status_message text,

  is_active boolean default true not null,
  connected_at timestamp with time zone default now(),
  last_notified_at timestamp with time zone,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_line_connections_user_id on line_connections(user_id);
create index idx_line_connections_line_user_id on line_connections(line_user_id);
create index idx_line_connections_is_active on line_connections(is_active);

-- RLS Policies
alter table line_connections enable row level security;

create policy "Users can view their own LINE connection"
on line_connections for select
using (auth.uid() = user_id);

create policy "Users can insert their own LINE connection"
on line_connections for insert
with check (auth.uid() = user_id);

create policy "Users can update their own LINE connection"
on line_connections for update
using (auth.uid() = user_id);

create policy "Users can delete their own LINE connection"
on line_connections for delete
using (auth.uid() = user_id);

-- Trigger to update updated_at
create trigger line_connections_updated_at
  before update on line_connections
  for each row execute function update_updated_at();
```

### 9. notification_settings

User preferences for LINE notifications.

```sql
create table notification_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique not null,

  -- Daily Summary
  daily_summary_enabled boolean default true not null,
  daily_summary_time time default '08:00' not null,

  -- Event Reminders
  event_reminder_enabled boolean default true not null,
  event_reminder_minutes integer default 5 not null,

  -- Task Reminders
  task_reminder_enabled boolean default true not null,
  task_due_reminder_enabled boolean default true not null,
  task_due_reminder_time time default '09:00' not null,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes
create index idx_notification_settings_user_id on notification_settings(user_id);
create index idx_notification_settings_daily_summary on notification_settings(daily_summary_enabled, daily_summary_time);

-- RLS Policies
alter table notification_settings enable row level security;

create policy "Users can view their own notification settings"
on notification_settings for select
using (auth.uid() = user_id);

create policy "Users can insert their own notification settings"
on notification_settings for insert
with check (auth.uid() = user_id);

create policy "Users can update their own notification settings"
on notification_settings for update
using (auth.uid() = user_id);

-- Trigger to update updated_at
create trigger notification_settings_updated_at
  before update on notification_settings
  for each row execute function update_updated_at();

-- Trigger to auto-create default settings when LINE is connected
create or replace function create_default_notification_settings()
returns trigger as $$
begin
  insert into notification_settings (user_id)
  values (new.user_id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql;

create trigger on_line_connected
  after insert on line_connections
  for each row execute function create_default_notification_settings();
```

## Audit & Logging (Optional)

### 10. line_messages_log

Logs all LINE messages sent for debugging and rate limiting.

```sql
create table line_messages_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  line_user_id text not null,

  message_type text not null, -- 'daily_summary', 'event_reminder', 'task_reminder'
  success boolean default true not null,
  error_message text,

  sent_at timestamp with time zone default now()
);

-- Indexes
create index idx_line_messages_log_user_id on line_messages_log(user_id);
create index idx_line_messages_log_sent_at on line_messages_log(sent_at desc);
create index idx_line_messages_log_message_type on line_messages_log(message_type);

-- RLS Policies
alter table line_messages_log enable row level security;

create policy "Users can view their own message logs"
on line_messages_log for select
using (auth.uid() = user_id);

-- Function to get monthly message count (for rate limiting)
create or replace function get_monthly_message_count()
returns integer as $$
declare
  msg_count integer;
begin
  select count(*) into msg_count
  from line_messages_log
  where sent_at >= date_trunc('month', now())
  and success = true;

  return msg_count;
end;
$$ language plpgsql security definer;

-- Auto-delete logs older than 3 months (run monthly)
create or replace function cleanup_old_message_logs()
returns void as $$
begin
  delete from line_messages_log
  where sent_at < now() - interval '3 months';
end;
$$ language plpgsql;
```

## Useful Views

### view: home_members_with_profiles

Combines home members with user profiles for easier querying.

```sql
create or replace view home_members_with_profiles as
select
  hm.id,
  hm.home_id,
  hm.user_id,
  hm.role,
  hm.joined_at,
  p.name,
  p.email,
  p.avatar_url
from home_members hm
join profiles p on p.id = hm.user_id;
```

### view: upcoming_events

Events in the next 7 days.

```sql
create or replace view upcoming_events as
select
  e.*,
  h.name as home_name,
  p.name as creator_name
from events e
join homes h on h.id = e.home_id
left join profiles p on p.id = e.created_by
where e.date >= current_date
and e.date <= current_date + interval '7 days'
order by e.date, e.time;
```

### view: pending_tasks

All pending tasks with due dates.

```sql
create or replace view pending_tasks as
select
  t.*,
  h.name as home_name,
  p.name as creator_name,
  a.name as assigned_to_name
from tasks t
join homes h on h.id = t.home_id
left join profiles p on p.id = t.created_by
left join profiles a on a.id = t.assigned_to
where t.status = 'pending'
order by
  case when t.due_date is null then 1 else 0 end,
  t.due_date,
  t.created_at;
```

## Useful Functions

### get_user_homes

Get all homes for a user with member count.

```sql
create or replace function get_user_homes(user_uuid uuid)
returns table (
  home_id uuid,
  home_name text,
  home_description text,
  role home_role,
  member_count bigint,
  joined_at timestamp with time zone
) as $$
begin
  return query
  select
    h.id,
    h.name,
    h.description,
    hm.role,
    (select count(*) from home_members where home_id = h.id),
    hm.joined_at
  from homes h
  join home_members hm on hm.home_id = h.id
  where hm.user_id = user_uuid
  order by hm.joined_at desc;
end;
$$ language plpgsql security definer;
```

### get_home_activity

Get recent activity for a home.

```sql
create or replace function get_home_activity(
  home_uuid uuid,
  limit_count integer default 20
)
returns table (
  activity_type text,
  activity_title text,
  activity_description text,
  created_by_name text,
  created_at timestamp with time zone
) as $$
begin
  return query
  (
    select
      'event'::text,
      e.title,
      e.description,
      p.name,
      e.created_at
    from events e
    left join profiles p on p.id = e.created_by
    where e.home_id = home_uuid
  )
  union all
  (
    select
      'task'::text,
      t.title,
      t.description,
      p.name,
      t.created_at
    from tasks t
    left join profiles p on p.id = t.created_by
    where t.home_id = home_uuid
  )
  union all
  (
    select
      'note'::text,
      coalesce(n.title, 'บันทึก'),
      n.content,
      p.name,
      n.created_at
    from notes n
    left join profiles p on p.id = n.created_by
    where n.home_id = home_uuid
  )
  order by created_at desc
  limit limit_count;
end;
$$ language plpgsql security definer;
```

### search_notes

Full-text search for notes in Thai.

```sql
create or replace function search_notes(
  home_uuid uuid,
  search_query text
)
returns table (
  id uuid,
  title text,
  content text,
  created_by uuid,
  created_at timestamp with time zone,
  rank real
) as $$
begin
  return query
  select
    n.id,
    n.title,
    n.content,
    n.created_by,
    n.created_at,
    ts_rank(to_tsvector('thai', n.content), plainto_tsquery('thai', search_query)) as rank
  from notes n
  where n.home_id = home_uuid
  and to_tsvector('thai', n.content) @@ plainto_tsquery('thai', search_query)
  order by rank desc;
end;
$$ language plpgsql security definer;
```

## Database Setup Script

Complete script to initialize the database:

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create custom types
create type home_role as enum ('owner', 'admin', 'member');
create type task_status as enum ('pending', 'completed', 'cancelled');
create type invitation_status as enum ('pending', 'accepted', 'declined', 'expired');

-- Create tables (in order of dependencies)
-- 1. profiles
-- 2. homes
-- 3. home_members
-- 4. events
-- 5. tasks
-- 6. notes
-- 7. invitations
-- 8. line_connections
-- 9. notification_settings
-- 10. line_messages_log

-- Create all triggers
-- Create all functions
-- Create all views
-- Create all RLS policies

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant all on all routines in schema public to authenticated;
```

## Database Migrations

Use Supabase migrations or a tool like `dbmate` for version control:

```bash
# Create new migration
supabase migration new initial_schema

# Apply migrations
supabase db push

# Reset database (development only)
supabase db reset
```

## Performance Optimization

### Indexes Summary

Critical indexes for performance:

```sql
-- Composite indexes for common queries
create index idx_events_home_date on events(home_id, date);
create index idx_tasks_home_status on tasks(home_id, status);
create index idx_home_members_home_user on home_members(home_id, user_id);

-- Covering indexes for common queries
create index idx_events_upcoming on events(date, time) where date >= current_date;
create index idx_tasks_pending_due on tasks(due_date) where status = 'pending';
```

### Query Optimization

Use `EXPLAIN ANALYZE` to optimize slow queries:

```sql
explain analyze
select * from events
where home_id = 'xxx'
and date >= current_date
order by date, time;
```

## Backup Strategy

1. **Supabase Auto Backups**: Daily backups (Pro plan)
2. **Manual Exports**: Weekly exports for critical data
3. **Point-in-Time Recovery**: Available on Supabase Pro plan

```bash
# Export database
pg_dump $DATABASE_URL > backup.sql

# Import database
psql $DATABASE_URL < backup.sql
```

## Security Considerations

1. **RLS Enabled**: All tables have RLS policies
2. **No Direct Access**: Users cannot access other homes' data
3. **Service Role**: Use sparingly, only for cron jobs
4. **SQL Injection**: Use parameterized queries only
5. **Sensitive Data**: Never log passwords or tokens

## Testing Data

Seed script for development:

```sql
-- Create test users (done via Supabase Auth)
-- Create test homes
insert into homes (name, description, created_by)
values
  ('บ้านทดสอบ 1', 'บ้านสำหรับทดสอบระบบ', 'user-1-uuid'),
  ('บ้านทดสอบ 2', 'บ้านสำหรับทดสอบการเชิญ', 'user-2-uuid');

-- Create test events
insert into events (home_id, created_by, title, description, date, time)
values
  ('home-1-uuid', 'user-1-uuid', 'ประชุมทีม', 'ประชุมวางแผนโปรเจค', current_date + 1, '10:00'),
  ('home-1-uuid', 'user-1-uuid', 'รับลูกเลิกเรียน', null, current_date, '15:30');

-- Create test tasks
insert into tasks (home_id, created_by, title, due_date)
values
  ('home-1-uuid', 'user-1-uuid', 'ซื้อของที่ตลาด', current_date),
  ('home-1-uuid', 'user-1-uuid', 'ชำระค่าไฟ', current_date + 3);
```

## Cost Estimates

### Supabase Free Tier
- Database: 500 MB
- Storage: 1 GB
- Bandwidth: 2 GB
- Row Level Security: ✅
- Real-time: ✅

**Estimated Usage (2 users):**
- Database: ~10 MB (well within limit)
- Storage: ~1 MB for avatars
- Bandwidth: ~100 MB/month

**Conclusion**: Free tier is more than sufficient for 2-10 users.

## Monitoring

### Key Metrics to Track

1. Database size growth
2. Query performance (slow queries)
3. RLS policy performance
4. Connection pool usage
5. Failed LINE message rate

### Supabase Dashboard

Monitor via Supabase Dashboard:
- Database health
- Query performance
- API usage
- Auth metrics

## References

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
