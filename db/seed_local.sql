-- Datos mínimos para la base LOCAL (solo pruebas en tu PC). La base de Cloudflare ya los tiene.
INSERT OR IGNORE INTO category (id, slug, name, sort_order) VALUES
 (1,'termos-bazar','Termos y Bazar',1),
 (2,'hogar-descanso','Hogar y Descanso',2),
 (3,'viajes-maletas','Viajes y Maletas',3),
 (4,'tecnologia','Tecnología y Accesorios',4);

INSERT OR IGNORE INTO seller (id, slug, name, phone) VALUES
 (1,'christian','Christian','595994354894');

UPDATE settings SET value='{"name":"Catálogo Express PY","logo":null,"default_phone":"595994354894"}' WHERE key='business';
