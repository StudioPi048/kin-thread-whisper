-- Create genogram_layouts table
CREATE TABLE public.genogram_layouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Layout Atual',
  viewport jsonb,
  is_fixed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT genogram_layouts_pkey PRIMARY KEY (id)
);

-- Create genogram_node_positions table
CREATE TABLE public.genogram_node_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.genogram_layouts(id) ON DELETE CASCADE,
  node_id uuid NOT NULL,
  node_type text NOT NULL, -- 'person', 'union', etc.
  x numeric NOT NULL,
  y numeric NOT NULL,
  layout_mode text NOT NULL DEFAULT 'AUTO', -- 'AUTO' | 'MANUAL'
  collapsed boolean NOT NULL DEFAULT false,
  CONSTRAINT genogram_node_positions_pkey PRIMARY KEY (id),
  CONSTRAINT genogram_node_positions_layout_node_key UNIQUE (layout_id, node_id)
);

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at_genogram_layouts
  BEFORE UPDATE ON public.genogram_layouts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Migrate existing position data from genogram_persons to the new schema
DO $$
DECLARE
  v_client record;
  v_layout_id uuid;
  v_person record;
BEGIN
  -- For each client that has persons with positions, create a default layout
  FOR v_client IN (
    SELECT DISTINCT client_id 
    FROM public.genogram_persons 
    WHERE position_x IS NOT NULL AND position_y IS NOT NULL
  )
  LOOP
    -- Create default layout for the client
    INSERT INTO public.genogram_layouts (client_id, name, is_fixed)
    VALUES (v_client.client_id, 'Layout Automático Migrado', false)
    RETURNING id INTO v_layout_id;

    -- Insert positions for each person of this client
    FOR v_person IN (
      SELECT id, position_x, position_y 
      FROM public.genogram_persons 
      WHERE client_id = v_client.client_id AND position_x IS NOT NULL AND position_y IS NOT NULL
    )
    LOOP
      INSERT INTO public.genogram_node_positions (layout_id, node_id, node_type, x, y, layout_mode)
      VALUES (v_layout_id, v_person.id, 'person', v_person.position_x, v_person.position_y, 'MANUAL');
    END LOOP;
  END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.genogram_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genogram_node_positions ENABLE ROW LEVEL SECURITY;

-- Policies for genogram_layouts
CREATE POLICY "Users can view their own clients layouts" 
  ON public.genogram_layouts FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = genogram_layouts.client_id 
      AND c.professional_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert layouts for their clients" 
  ON public.genogram_layouts FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = client_id 
      AND c.professional_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own clients layouts" 
  ON public.genogram_layouts FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = genogram_layouts.client_id 
      AND c.professional_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own clients layouts" 
  ON public.genogram_layouts FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c 
      WHERE c.id = genogram_layouts.client_id 
      AND c.professional_id = auth.uid()
    )
  );

-- Policies for genogram_node_positions
CREATE POLICY "Users can view their node positions" 
  ON public.genogram_node_positions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.genogram_layouts gl
      JOIN public.clients c ON c.id = gl.client_id
      WHERE gl.id = genogram_node_positions.layout_id 
      AND c.professional_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert node positions" 
  ON public.genogram_node_positions FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.genogram_layouts gl
      JOIN public.clients c ON c.id = gl.client_id
      WHERE gl.id = layout_id 
      AND c.professional_id = auth.uid()
    )
  );

CREATE POLICY "Users can update node positions" 
  ON public.genogram_node_positions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.genogram_layouts gl
      JOIN public.clients c ON c.id = gl.client_id
      WHERE gl.id = genogram_node_positions.layout_id 
      AND c.professional_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete node positions" 
  ON public.genogram_node_positions FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.genogram_layouts gl
      JOIN public.clients c ON c.id = gl.client_id
      WHERE gl.id = genogram_node_positions.layout_id 
      AND c.professional_id = auth.uid()
    )
  );
