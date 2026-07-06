
CREATE TABLE IF NOT EXISTS public.genogram_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Layout Atual',
  is_fixed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS genogram_layouts_client_idx ON public.genogram_layouts(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genogram_layouts TO authenticated;
GRANT ALL ON public.genogram_layouts TO service_role;
ALTER TABLE public.genogram_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "genogram_layouts_owner_select" ON public.genogram_layouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.professional_id = auth.uid()));
CREATE POLICY "genogram_layouts_owner_insert" ON public.genogram_layouts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.professional_id = auth.uid()));
CREATE POLICY "genogram_layouts_owner_update" ON public.genogram_layouts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.professional_id = auth.uid()));
CREATE POLICY "genogram_layouts_owner_delete" ON public.genogram_layouts FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.professional_id = auth.uid()));

CREATE TRIGGER update_genogram_layouts_updated_at
  BEFORE UPDATE ON public.genogram_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.genogram_node_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  layout_id UUID NOT NULL REFERENCES public.genogram_layouts(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL DEFAULT 'person',
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  layout_mode TEXT NOT NULL DEFAULT 'MANUAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT genogram_node_positions_layout_node_key UNIQUE (layout_id, node_id)
);
CREATE INDEX IF NOT EXISTS genogram_node_positions_layout_idx ON public.genogram_node_positions(layout_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.genogram_node_positions TO authenticated;
GRANT ALL ON public.genogram_node_positions TO service_role;
ALTER TABLE public.genogram_node_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "genogram_node_positions_owner_select" ON public.genogram_node_positions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.genogram_layouts l JOIN public.clients c ON c.id = l.client_id
                  WHERE l.id = layout_id AND c.professional_id = auth.uid()));
CREATE POLICY "genogram_node_positions_owner_insert" ON public.genogram_node_positions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.genogram_layouts l JOIN public.clients c ON c.id = l.client_id
                       WHERE l.id = layout_id AND c.professional_id = auth.uid()));
CREATE POLICY "genogram_node_positions_owner_update" ON public.genogram_node_positions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.genogram_layouts l JOIN public.clients c ON c.id = l.client_id
                  WHERE l.id = layout_id AND c.professional_id = auth.uid()));
CREATE POLICY "genogram_node_positions_owner_delete" ON public.genogram_node_positions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.genogram_layouts l JOIN public.clients c ON c.id = l.client_id
                  WHERE l.id = layout_id AND c.professional_id = auth.uid()));

CREATE TRIGGER update_genogram_node_positions_updated_at
  BEFORE UPDATE ON public.genogram_node_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
