-- Migración 01 · ejecutar UNA sola vez en la base local y UNA sola vez en la remota.
ALTER TABLE seller ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE lead ADD COLUMN sold_at INTEGER;       -- se usará al marcar "Vendido"
ALTER TABLE lead ADD COLUMN visitor_id TEXT;       -- id anónimo del navegador (para contar clientes únicos)
ALTER TABLE lead_item ADD COLUMN list_price_gs INTEGER; -- precio de lista al momento del pedido
CREATE INDEX IF NOT EXISTS idx_lead_created ON lead(created_at);
