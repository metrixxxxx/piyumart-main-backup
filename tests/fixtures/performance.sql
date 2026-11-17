-- Extend the synthetic finance schema for catalog and history read tests.
CREATE TABLE categories(id serial PRIMARY KEY,name text,slug text);
INSERT INTO categories(name,slug) VALUES('Books','books'),('Electronics','electronics');
ALTER TABLE products ADD COLUMN description text DEFAULT '',ADD COLUMN seller_name text DEFAULT 'Demo seller',
  ADD COLUMN category_id integer DEFAULT 1,ADD COLUMN department text DEFAULT 'CCS',ADD COLUMN meetup_point text DEFAULT 'Library',
  ADD COLUMN average_rating numeric DEFAULT 0,ADD COLUMN total_ratings integer DEFAULT 0,
  ADD COLUMN is_featured boolean DEFAULT false,ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE product_variants ADD COLUMN name text,ADD COLUMN stock integer DEFAULT 10,ADD COLUMN value text;
CREATE TABLE product_images(id serial PRIMARY KEY,product_id integer,image_url text,sort_order integer DEFAULT 0);
CREATE TABLE attribute_definitions(id serial PRIMARY KEY,name text,label text,type text);
CREATE TABLE product_attributes(id serial PRIMARY KEY,product_id integer,attribute_definition_id integer,value text);
CREATE TABLE product_reviews(id serial PRIMARY KEY,product_id integer,user_id integer,rating integer,comment text,created_at timestamptz DEFAULT now());
CREATE TABLE seller_applications(id serial PRIMARY KEY,user_id integer,department text,note text,status text,remarks text,submitted_at timestamptz DEFAULT now(),reviewed_at timestamptz,id_proof_url text);
INSERT INTO seller_applications(user_id,department,status,id_proof_url) SELECT 1,'CCS','approved','private/fixture-proof' FROM generate_series(1,55);
INSERT INTO users VALUES(6,'Second seller','','second@example.invalid','seller','active'),(7,'Inactive seller','','inactive@example.invalid','seller','pending');
UPDATE products SET description=repeat('Product description ',250),is_featured=true;
INSERT INTO products(seller_id,name,description,price,stock,status,is_visible,category_id)
  SELECT 2,'Catalog item '||n,repeat('Product description ',250),n,20,'approved',true,1+(n%2) FROM generate_series(2,250)n;
INSERT INTO products(seller_id,name,description,price,stock,status,is_visible)
  SELECT 6,'Other seller item '||n,'Public fixture',150,20,'approved',true FROM generate_series(1,10)n;
INSERT INTO products(seller_id,name,price,stock,status,is_visible) VALUES
  (2,'Hidden fixture',100,20,'approved',false),(2,'Pending fixture',100,20,'pending',true),
  (7,'Inactive fixture',100,20,'approved',true),(6,'Literal%Notebook',100,20,'approved',true);
INSERT INTO attribute_definitions(name,label,type) VALUES('color','Color','text');
INSERT INTO product_attributes(product_id,attribute_definition_id,value) SELECT id,1,'blue' FROM products;
INSERT INTO product_images(product_id,image_url,sort_order) SELECT id,'https://example.invalid/'||id||'/first.jpg',0 FROM products;
INSERT INTO product_images(product_id,image_url,sort_order) SELECT id,'https://example.invalid/'||id||'/second.jpg',1 FROM products;
INSERT INTO product_variants(product_id,name,label,value,stock) SELECT id,'size','Large','L',10 FROM products;
INSERT INTO orders(user_id,seller_id,payment_method,total,status,created_at)
  SELECT 1,2,'cod',100,CASE WHEN n%2=0 THEN 'completed' ELSE 'pending' END,'2026-01-01T00:00:00Z'::timestamptz FROM generate_series(1,75)n;
INSERT INTO order_items(order_id,product_id,quantity,price,name,seller_name,image_url)
  SELECT id,1,1,100,'Order snapshot','Demo seller','https://example.invalid/snapshot.jpg' FROM orders;
-- The latest legacy order has items from two sellers and no seller_id snapshot.
INSERT INTO orders(user_id,payment_method,total,status) VALUES(1,'cod',250,'pending');
INSERT INTO order_items(order_id,product_id,quantity,price,name,seller_name)
  SELECT MAX(id),1,1,100,'Legacy own item','Demo seller' FROM orders;
INSERT INTO order_items(order_id,product_id,quantity,price,name,seller_name)
  SELECT MAX(o.id),(SELECT MIN(id) FROM products WHERE seller_id=6),1,150,'Legacy other item','Second seller' FROM orders o;
INSERT INTO product_reviews(product_id,user_id,rating,comment) SELECT 1,1,5,'Review fixture '||n FROM generate_series(1,55)n;
