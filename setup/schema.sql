CREATE TABLE users (
  user_id               serial PRIMARY KEY,
  username              varchar(20) NOT NULL,
  password              varchar(100),
  role                  varchar(20) NOT NULL,
  api_key               varchar(20) UNIQUE,
  fullname              varchar(100),
  email                 varchar(100)
);
CREATE INDEX users_username_idx ON users (username);
CREATE TABLE devices (
  device_id             serial PRIMARY KEY,
  api_key               varchar(20) REFERENCES users(api_key),
  identifier            varchar(50) NOT NULL,
  alias                 varchar(100),
  fixed_loc_lat         double precision,
  fixed_loc_lon         double precision,
  UNIQUE (api_key, identifier)
);
CREATE TABLE shared_devices (
  shared_devices_id     serial PRIMARY KEY,
  device_id             integer NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  user_id               integer NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE (device_id, user_id)
);
CREATE TABLE locations (
  location_id           serial PRIMARY KEY,
  device_id             integer NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
  device_id_tag         integer REFERENCES devices(device_id) ON DELETE CASCADE,
  loc_timestamp         timestamp without time zone,
  loc_lat               double precision,
  loc_lon               double precision,
  loc_type              varchar(20),
  loc_attr              json,
  created_at            timestamp without time zone
);
CREATE TABLE sessions (
  sid                   varchar NOT NULL COLLATE "default",
  sess                  json NOT NULL,
  expire                timestamp(6) NOT NULL,
  CONSTRAINT sessions_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);

INSERT INTO users (username, password, role, api_key, fullname) VALUES ('admin','$2a$10$Rve2CVutQ8bi2Yph/u/tsesnFWt1SPtMRXBkKWZeQbJLZz16Uqn1y','admin','demokey','Administrator');
