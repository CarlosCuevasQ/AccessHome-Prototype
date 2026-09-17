begin;

-- Esquemas nuevos: si ya existen, detenerse y reconciliar su historial.
create schema accesshome;
create schema accesshome_private;
revoke all on schema accesshome, accesshome_private from public,anon,authenticated,service_role;

create type accesshome.app_role as enum ('admin', 'resident', 'guard');

create table accesshome.condominiums (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null check (length(trim(name)) > 0),
  address varchar(250) not null default '',
  time_zone text not null default 'America/Mexico_City',
  created_at timestamptz not null default now()
);

create table accesshome.residences (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references accesshome.condominiums(id),
  number integer not null check (number between 1 and 99999),
  name text generated always as ('Casa ' || number::text) stored,
  street varchar(100) not null check (length(trim(street)) > 0),
  active boolean not null default true,
  principal_user_id uuid,
  created_at timestamptz not null default now(),
  unique (condominium_id, number),
  unique (id, condominium_id)
);

-- Auth administra contraseñas/correos de login. Este perfil contiene autorización.
create table accesshome.profiles (
  user_id uuid primary key references auth.users(id),
  condominium_id uuid not null references accesshome.condominiums(id),
  residence_id uuid,
  display_name varchar(150) not null check (length(trim(display_name)) > 0),
  role accesshome.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((role = 'resident' and residence_id is not null)
    or (role in ('admin', 'guard') and residence_id is null)),
  foreign key (residence_id, condominium_id)
    references accesshome.residences(id, condominium_id),
  unique (user_id, condominium_id),
  unique (user_id, condominium_id, residence_id)
);

-- Impide nombrar principal a una cuenta de otra casa o a un admin/guardia.
alter table accesshome.residences add constraint residences_principal_membership_fk
  foreign key (principal_user_id, condominium_id, id)
  references accesshome.profiles(user_id, condominium_id, residence_id)
  deferrable initially deferred;

create table accesshome.inhabitants (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  residence_id uuid not null,
  user_id uuid unique,
  first_name varchar(60) not null check (length(trim(first_name)) > 0),
  last_name varchar(80) not null check (length(trim(last_name)) > 0),
  phone varchar(30) not null default '',
  email varchar(150) not null default '',
  relationship varchar(100) not null default '',
  active boolean not null default true,
  foreign key (residence_id, condominium_id)
    references accesshome.residences(id, condominium_id),
  foreign key (user_id, condominium_id, residence_id)
    references accesshome.profiles(user_id, condominium_id, residence_id),
  unique (id, condominium_id, residence_id)
);

create table accesshome.residence_vehicles (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null,
  residence_id uuid not null,
  owner_inhabitant_id uuid,
  plates varchar(15) not null check (plates ~ '^[A-Z0-9][A-Z0-9 -]*$'),
  plate_key text generated always as (regexp_replace(upper(plates), '[[:space:]-]', '', 'g')) stored,
  brand varchar(60) not null check (length(trim(brand)) > 0),
  model varchar(60) not null check (length(trim(model)) > 0),
  color varchar(40) not null check (length(trim(color)) > 0),
  active boolean not null default true,
  foreign key (residence_id, condominium_id)
    references accesshome.residences(id, condominium_id),
  foreign key (owner_inhabitant_id, condominium_id, residence_id)
    references accesshome.inhabitants(id, condominium_id, residence_id),
  unique (condominium_id, plate_key)
);

create index profiles_condominium_idx on accesshome.profiles(condominium_id);
create index profiles_residence_idx on accesshome.profiles(residence_id);
create index inhabitants_residence_idx on accesshome.inhabitants(residence_id);
create index residence_vehicles_residence_idx on accesshome.residence_vehicles(residence_id);

alter table accesshome.condominiums enable row level security;
alter table accesshome.profiles enable row level security;
alter table accesshome.residences enable row level security;
alter table accesshome.inhabitants enable row level security;
alter table accesshome.residence_vehicles enable row level security;

revoke all on all tables in schema accesshome from public,anon,authenticated,service_role;
-- Ninguna tabla es accesible hasta aplicar las políticas de lectura de 003.
commit;
