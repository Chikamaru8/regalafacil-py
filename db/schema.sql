-- Catálogo WhatsApp · esquema D1 (SQLite)
-- Fechas: epoch en segundos (UTC). Precios: enteros en Guaraníes.
-- Aplicar local:  npx wrangler d1 execute catalogo-db --local  --file=db/schema.sql
-- Aplicar remoto: npx wrangler d1 execute catalogo-db --remote --file=db/schema.sql

PRAGMA foreign_keys = ON;

-- Configuración clave/valor (valor = JSON).
-- Claves: business, selector, themes, catalog_version
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Quién entra al admin. La autenticación la hace Cloudflare Access;
-- esta tabla solo mapea email -> rol.
CREATE TABLE IF NOT EXISTS staff (
  email     TEXT PRIMARY KEY,
  role      TEXT NOT NULL CHECK (role IN ('owner','seller')),
  seller_id INTEGER REFERENCES seller(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS category (
  id         INTEGER PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS product (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_gs    INTEGER NOT NULL CHECK (price_gs >= 0),
  category_id INTEGER REFERENCES category(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  attributes  TEXT NOT NULL DEFAULT '{}',   -- JSON: campos propios de cada rubro (talle, color, medidas...)
  created_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  updated_at  INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER))
);
CREATE INDEX IF NOT EXISTS idx_product_status ON product(status, category_id);

-- Fotos guardadas dentro de D1 (sin R2). Se redimensionan en el celular (~100-200 KB).
-- IMPORTANTE: en listados nunca usar SELECT *; pedir solo id, product_id, mime, bytes.
CREATE TABLE IF NOT EXISTS product_image (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL DEFAULT 'image/webp',
  bytes      INTEGER NOT NULL,
  data       BLOB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_image_product ON product_image(product_id, sort_order);

-- Etiquetas para el selector de regalos, agrupadas:
-- recipient (mamá, pareja, niño...), occasion (cumpleaños...), age (joven, adulto...), other
CREATE TABLE IF NOT EXISTS tag (
  id        INTEGER PRIMARY KEY,
  group_key TEXT NOT NULL,
  slug      TEXT NOT NULL,
  label     TEXT NOT NULL,
  UNIQUE (group_key, slug)
);

CREATE TABLE IF NOT EXISTS product_tag (
  product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tag(id)     ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_product_tag_tag ON product_tag(tag_id);

-- Ofertas por tiempo. Vence sola: el snapshot y el servidor comparan contra la hora actual.
CREATE TABLE IF NOT EXISTS offer (
  id             INTEGER PRIMARY KEY,
  product_id     INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  offer_price_gs INTEGER NOT NULL CHECK (offer_price_gs >= 0),
  starts_at      INTEGER NOT NULL,
  ends_at        INTEGER NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_offer_product ON offer(product_id, ends_at);

CREATE TABLE IF NOT EXISTS seller (
  id         INTEGER PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,          -- /v/<slug>
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,                 -- solo dígitos con código de país, ej. 5959XXXXXXXX
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER))
);

-- Intención de compra. 'ref' lo genera el cliente (navegador) y viaja en el mensaje de WhatsApp.
CREATE TABLE IF NOT EXISTS lead (
  id             INTEGER PRIMARY KEY,
  ref            TEXT NOT NULL UNIQUE,      -- ej. A7K2 ; INSERT OR IGNORE evita duplicados
  seller_id      INTEGER REFERENCES seller(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','chatting','sold','lost')),
  customer_name  TEXT,
  customer_phone TEXT,                      -- opcional
  note           TEXT,
  created_at     INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER)),
  updated_at     INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER))
);
CREATE INDEX IF NOT EXISTS idx_lead_seller ON lead(seller_id, status, created_at DESC);

-- Se guardan nombre y precio al momento del pedido: el producto puede cambiar después.
CREATE TABLE IF NOT EXISTS lead_item (
  lead_id      INTEGER NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES product(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty > 0),
  unit_price_gs INTEGER NOT NULL,
  PRIMARY KEY (lead_id, product_name)
);

-- Valores iniciales
INSERT OR IGNORE INTO settings(key, value) VALUES
  ('business', '{"name":"Mi Tienda","logo":null,"default_phone":null}'),
  ('selector', '{"budget_ranges":[[0,100000],[100000,250000],[250000,500000],[500000,null]]}'),
  ('themes',   '{"default":"base","schedule":[]}'),
  ('catalog_version', '1');

INSERT OR IGNORE INTO tag(group_key, slug, label) VALUES
  ('recipient','mama','Mamá'), ('recipient','papa','Papá'), ('recipient','pareja','Pareja'),
  ('recipient','amigo','Amigo/a'), ('recipient','nino','Niño/a'),
  ('occasion','cumple','Cumpleaños'), ('occasion','navidad','Navidad'), ('occasion','aniversario','Aniversario'),
  ('age','joven','Joven'), ('age','adulto','Adulto'), ('age','mayor','Adulto mayor');

-- ---------------------------------------------------------------
-- Consulta de referencia: catálogo activo con precio final vigente
-- (la usa la función que genera el snapshot)
-- ---------------------------------------------------------------
-- SELECT p.id, p.slug, p.name, p.price_gs,
--        (SELECT MIN(o.offer_price_gs) FROM offer o
--          WHERE o.product_id = p.id
--            AND CAST(strftime('%s','now') AS INTEGER) BETWEEN o.starts_at AND o.ends_at) AS offer_price_gs
--   FROM product p WHERE p.status = 'active';
