-- Isolated integration-test schema only. These are synthetic records, not users.
CREATE TABLE users(id integer PRIMARY KEY,name text,last_name text,email text,role text,status text);
CREATE TABLE products(id serial PRIMARY KEY,seller_id integer,name text,image_url text,price numeric(14,2),stock integer,status text,is_visible boolean,sold_count integer DEFAULT 0);
CREATE TABLE product_variants(id serial PRIMARY KEY,product_id integer,label text,image_url text,price_override numeric(14,2));
CREATE TABLE orders(id serial PRIMARY KEY,user_id integer,seller_id integer,name text,email text,address text,payment_method text,total numeric(14,2),status varchar,created_at timestamp DEFAULT now(),confirmed_at timestamptz,shipped_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,tracking_number text,courier text);
CREATE TABLE order_items(id serial PRIMARY KEY,order_id integer,product_id integer,quantity integer,price numeric(14,2),variant text,name text,image_url text,seller_name text);
ALTER TABLE orders ADD COLUMN seller_note text;
ALTER TABLE orders ADD COLUMN pickup_proof_path text;
ALTER TABLE orders ADD COLUMN pickup_proof_uploaded_at timestamptz;
CREATE TABLE bao_audit_logs(id serial PRIMARY KEY,actor_id integer,action text,entity_type text,entity_id text,reason text,metadata jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE notifications(id serial PRIMARY KEY,user_id integer,type text,message text,is_read boolean DEFAULT false,created_at timestamptz DEFAULT now());
CREATE TABLE bao_commission_rates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),percentage numeric,effective_at timestamptz,created_at timestamptz DEFAULT now(),changed_by integer,notes text);
CREATE TABLE order_commissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id integer UNIQUE,commission_rate_id uuid NOT NULL,commission_rate numeric CHECK(commission_rate>0 AND commission_rate<=100),order_amount numeric,commission_amount numeric,seller_earnings numeric,created_at timestamptz DEFAULT now());
CREATE TABLE marketplace_reports(id serial PRIMARY KEY,status text);
INSERT INTO users VALUES(1,'Demo buyer','','buyer@example.invalid','user','active'),(2,'Demo seller','','seller@example.invalid','seller','active'),(3,'Demo BAO','','bao@example.invalid','bao','active'),(4,'Demo admin','','admin@example.invalid','admin','active'),(5,'Other buyer','','other@example.invalid','user','active');
INSERT INTO products(seller_id,name,price,stock,status,is_visible) VALUES(2,'Demo textbook',1000,100,'approved',true);
