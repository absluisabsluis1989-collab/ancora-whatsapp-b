create table if not exists wallet_clients (
  id text primary key,
  owner_user_id text not null,
  phone text not null,
  display_name text,
  assigned_to text not null,
  conversation_id text not null,
  quote_row_id text not null,
  quote_id text not null,
  client_id text,
  simulated boolean not null default false,
  linked_at text not null,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists wallet_owner_phone_idx
  on wallet_clients (owner_user_id, phone);
