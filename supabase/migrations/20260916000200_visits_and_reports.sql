begin;

create type accesshome.invitation_status as enum ('activa', 'completada', 'cancelada', 'expirada');
create type accesshome.access_direction as enum ('entrada', 'salida');
create type accesshome.report_status as enum ('pendiente', 'en_proceso', 'completado');
create type accesshome.report_category as enum ('Seguridad', 'Acceso', 'Instalaciones', 'Administración', 'Otro');

create table accesshome.frequent_contacts (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  owner_user_id uuid not null,
  name varchar(120) not null check (length(trim(name)) > 0),
  phone varchar(30) not null default '',
  email varchar(150) not null default '',
  notes varchar(1000) not null default '',
  active boolean not null default true,
  foreign key (owner_user_id, condominium_id)
    references accesshome.profiles(user_id, condominium_id),
  unique (id, condominium_id)
);

create table accesshome.contact_vehicles (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  contact_id uuid not null,
  plates varchar(15) not null check (plates ~ '^[A-Z0-9][A-Z0-9 -]*$'),
  plate_key text generated always as (regexp_replace(upper(plates), '[[:space:]-]', '', 'g')) stored,
  brand varchar(60) not null default '',
  model varchar(60) not null default '',
  color varchar(40) not null default '',
  active boolean not null default true,
  foreign key (contact_id, condominium_id)
    references accesshome.frequent_contacts(id, condominium_id),
  unique (contact_id, plate_key)
);

create table accesshome.invitations (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  residence_id uuid not null,
  inviter_user_id uuid not null,
  contact_id uuid,
  visitor_name varchar(120) not null check (length(trim(visitor_name)) > 0),
  phone varchar(30) not null default '',
  inviter_name varchar(150) not null,
  residence_name varchar(100) not null,
  vehicle_plates varchar(15) check (vehicle_plates ~ '^[A-Z0-9][A-Z0-9 -]*$'),
  vehicle_brand varchar(60),
  vehicle_model varchar(60),
  vehicle_color varchar(40),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  max_uses smallint not null default 2 check (max_uses = 2),
  used_uses smallint not null default 0 check (used_uses between 0 and 2),
  status accesshome.invitation_status not null default 'activa',
  created_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check ((status = 'completada') = (used_uses = 2)),
  check (vehicle_plates is not null or
    (vehicle_brand is null and vehicle_model is null and vehicle_color is null)),
  foreign key (residence_id, condominium_id)
    references accesshome.residences(id, condominium_id),
  foreign key (inviter_user_id, condominium_id, residence_id)
    references accesshome.profiles(user_id, condominium_id, residence_id),
  foreign key (contact_id, condominium_id)
    references accesshome.frequent_contacts(id, condominium_id),
  unique (id, condominium_id, residence_id, inviter_user_id)
);

-- La URL es una capacidad: su token no forma parte de las consultas generales.
-- El RPC futuro generará 32 bytes aleatorios en servidor, codificados en hex.
-- Se conserva aquí para volver a mostrar/compartir el mismo QR desde su detalle.
create table accesshome_private.invitation_tokens (
  invitation_id uuid primary key references accesshome.invitations(id),
  token_value text not null unique check (token_value ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create table accesshome.access_records (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null,
  condominium_id uuid not null,
  residence_id uuid not null,
  inviter_user_id uuid not null,
  validated_by uuid,
  request_id uuid unique,
  source text not null default 'integrated' check (source in ('integrated', 'local_import')),
  visitor_name varchar(120) not null,
  residence_name varchar(100) not null,
  inviter_name varchar(150) not null,
  vehicle_plates varchar(15),
  vehicle_brand varchar(60),
  vehicle_model varchar(60),
  vehicle_color varchar(40),
  direction accesshome.access_direction not null,
  method text not null default 'QR' check (method = 'QR'),
  occurred_at timestamptz not null default now(),
  authorized boolean not null default true check (authorized),
  check (source = 'local_import' or (validated_by is not null and request_id is not null)),
  foreign key (invitation_id, condominium_id, residence_id, inviter_user_id)
    references accesshome.invitations(id, condominium_id, residence_id, inviter_user_id),
  foreign key (validated_by, condominium_id)
    references accesshome.profiles(user_id, condominium_id),
  unique (invitation_id, direction),
  check (vehicle_plates is not null or
    (vehicle_brand is null and vehicle_model is null and vehicle_color is null))
);

create table accesshome.reports (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  residence_id uuid not null,
  author_user_id uuid not null,
  author_name varchar(150) not null,
  residence_name varchar(100) not null,
  title varchar(120) not null check (length(trim(title)) > 0),
  category accesshome.report_category not null,
  description varchar(3000) not null check (length(trim(description)) > 0),
  status accesshome.report_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now() check (updated_at >= created_at),
  foreign key (author_user_id, condominium_id, residence_id)
    references accesshome.profiles(user_id, condominium_id, residence_id)
);

create index contacts_owner_idx on accesshome.frequent_contacts(owner_user_id);
create index invitations_residence_date_idx on accesshome.invitations(residence_id, created_at desc);
create index invitations_condominium_status_idx on accesshome.invitations(condominium_id, status, expires_at);
create index access_condominium_date_idx on accesshome.access_records(condominium_id, occurred_at desc);
create index access_residence_date_idx on accesshome.access_records(residence_id, occurred_at desc);
create index reports_author_idx on accesshome.reports(author_user_id, created_at desc);
create index reports_condominium_status_idx on accesshome.reports(condominium_id, status);

alter table accesshome.frequent_contacts enable row level security;
alter table accesshome.contact_vehicles enable row level security;
alter table accesshome.invitations enable row level security;
alter table accesshome.access_records enable row level security;
alter table accesshome.reports enable row level security;
alter table accesshome_private.invitation_tokens enable row level security;
revoke all on all tables in schema accesshome, accesshome_private from public,anon,authenticated,service_role;

commit;
