-- Productos de EJEMPLO para ver la tienda funcionando. Ejecutar UNA sola vez.
-- Se borran después desde el admin (o con: DELETE FROM product WHERE slug IN ('termo-acero-1l','sabanas-queen','maleta-cabina');)
INSERT OR IGNORE INTO product (slug, name, description, price_gs, category_id, attributes) VALUES
 ('termo-acero-1l','Termo de acero 1 litro','Mantiene frío o calor por 12 horas. Ideal para tereré.',89000,1,'{"Capacidad":"1 litro","Material":"Acero inoxidable"}'),
 ('sabanas-queen','Juego de sábanas queen','Algodón suave, 4 piezas.',159000,2,'{"Tamaño":"Queen","Piezas":"4"}'),
 ('maleta-cabina','Maleta de cabina rígida','Ruedas giratorias y candado TSA.',289000,3,'{"Tamaño":"Cabina 20 pulgadas"}');

INSERT OR IGNORE INTO product_tag (product_id, tag_id)
SELECT p.id, t.id FROM product p JOIN tag t ON
  (p.slug='termo-acero-1l' AND t.slug IN ('papa','amigo','cumple','adulto','joven'))
  OR (p.slug='sabanas-queen' AND t.slug IN ('mama','pareja','aniversario','navidad','adulto'))
  OR (p.slug='maleta-cabina' AND t.slug IN ('pareja','amigo','cumple','adulto'));

INSERT INTO offer (product_id, offer_price_gs, starts_at, ends_at)
SELECT id, 79000, CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER) + 7*86400
FROM product WHERE slug='termo-acero-1l';
