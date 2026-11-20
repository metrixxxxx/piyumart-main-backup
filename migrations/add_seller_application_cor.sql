-- Earlier applications have one unclassified proof in id_proof_url.
ALTER TABLE public.seller_applications ADD COLUMN IF NOT EXISTS cor_proof_url text;
