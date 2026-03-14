create table if not exists saved_digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date_label text not null,
  generated_at text not null,
  data jsonb not null
);

create index if not exists saved_digests_created_at_idx on saved_digests (created_at desc);
