UPDATE settings
SET value = '{"name":"Catálogo Express PY","logo":null,"default_phone":"595994354894"}'
WHERE key = 'business';

INSERT OR IGNORE INTO seller (id, slug, name, phone, active)
VALUES (1, 'christian', 'Christian', '595994354894', 1);

INSERT OR IGNORE INTO staff (email, role, seller_id)
VALUES ('changova@gmail.com', 'owner', 1);

INSERT OR IGNORE INTO category (slug, name, sort_order, active) VALUES
  ('termos-bazar', 'Termos y Bazar', 1, 1),
  ('hogar-descanso', 'Hogar y Descanso', 2, 1),
  ('viajes-maletas', 'Viajes y Maletas', 3, 1),
  ('tecnologia', 'Tecnología y Accesorios', 4, 1);