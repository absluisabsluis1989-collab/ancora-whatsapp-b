create table if not exists workspace_binding (
  id text primary key,
  owner_user_id text not null unique,
  claimed_at text not null
);

create table if not exists settings (
  owner_user_id text primary key,
  global_pause boolean not null default false,
  retention_days integer not null default 365,
  personal_drive_days integer not null default 5,
  window_start text not null default '08:00',
  window_end text not null default '18:00',
  model_calls_date text not null default '',
  model_calls integer not null default 0,
  updated_at text not null
);

create table if not exists provider_state (
  owner_user_id text primary key,
  connection text not null default 'not_connected',
  last_webhook_at text,
  last_received_at text,
  last_processed_at text,
  gap_note text not null,
  updated_at text not null
);

create table if not exists conversations (
  id text primary key,
  owner_user_id text not null,
  phone text not null,
  source text not null,
  display_name text,
  name_pending boolean not null default true,
  lane text not null,
  entry text not null,
  product text,
  city text,
  ages_json text not null default '[]',
  profession text,
  campaign_ref text,
  origin_confirmed boolean not null default false,
  stage text not null,
  automation text not null,
  responsible text not null,
  customer_has_spoken boolean not null default false,
  interest_notified boolean not null default false,
  draft text not null default '',
  pending_reason text,
  next_action text not null default '',
  last_inbound_at text,
  last_processed_at text,
  quote_status text,
  has_confirmed_materials boolean not null default false,
  known_quote_id text,
  scenario text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists conversations_owner_phone_idx
  on conversations (owner_user_id, phone);

create table if not exists messages (
  id text primary key,
  owner_user_id text not null,
  conversation_id text not null,
  provider_message_id text not null,
  direction text not null,
  author text not null,
  body text not null,
  payload text not null default '{}',
  source text not null,
  status text not null,
  draft_source text not null default 'none',
  is_echo boolean not null default false,
  from_me boolean not null default false,
  scenario text,
  created_at text not null
);

create unique index if not exists messages_owner_provider_idx
  on messages (owner_user_id, provider_message_id);

create index if not exists messages_conversation_idx
  on messages (owner_user_id, conversation_id, created_at);

create table if not exists jobs (
  id text primary key,
  owner_user_id text not null,
  conversation_id text,
  message_id text,
  kind text not null,
  status text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after text not null,
  locked_at text,
  last_error text,
  scenario text,
  created_at text not null
);

create unique index if not exists jobs_message_idx on jobs (owner_user_id, message_id);
create index if not exists jobs_status_idx on jobs (owner_user_id, status, run_after);

create table if not exists quotes (
  id text primary key,
  owner_user_id text not null,
  conversation_id text not null,
  request_key text not null,
  status text not null,
  solicitation_id text,
  quote_id text,
  client_id text,
  saved_confirmed boolean not null default false,
  simulated boolean not null default false,
  missing_json text not null default '[]',
  detail text not null default '',
  created_at text not null
);

create unique index if not exists quotes_request_key_idx
  on quotes (owner_user_id, request_key);

create table if not exists outbound_parts (
  id text primary key,
  owner_user_id text not null,
  conversation_id text not null,
  quote_id text,
  position integer not null,
  kind text not null,
  recipient_phone text not null,
  body text not null,
  attachment_ref text,
  state text not null,
  approval_hash text,
  scenario text,
  created_at text not null
);

create table if not exists notifications (
  id text primary key,
  owner_user_id text not null,
  conversation_id text,
  kind text not null,
  title text not null,
  body text not null,
  read_at text,
  scenario text,
  created_at text not null
);

create table if not exists audit_events (
  id text primary key,
  owner_user_id text not null,
  conversation_id text,
  kind text not null,
  detail text not null,
  scenario text,
  created_at text not null
);

create table if not exists stored_files (
  id text primary key,
  owner_user_id text not null,
  conversation_id text,
  scope text not null,
  kind text not null,
  version integer not null default 1,
  storage_ref text not null,
  name text not null,
  simulated boolean not null default false,
  created_at text not null
);

create table if not exists approvals (
  id text primary key,
  owner_user_id text not null,
  conversation_id text not null,
  recipient_phone text not null,
  body_hash text not null,
  attachment_hash text not null,
  status text not null,
  created_at text not null
);

create table if not exists module_notes (
  id text primary key,
  owner_user_id text not null,
  module text not null,
  role text not null,
  body text not null,
  created_at text not null
);
