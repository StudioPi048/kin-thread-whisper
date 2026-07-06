-- Altera o tipo da coluna node_id para text para suportar IDs sintéticos (ex: uniões)
ALTER TABLE public.genogram_node_positions ALTER COLUMN node_id TYPE text;
