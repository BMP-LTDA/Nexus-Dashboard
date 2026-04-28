-- Create orders table to receive webhook data
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total NUMERIC(10, 2) DEFAULT 0,
    subtotal NUMERIC(10, 2) DEFAULT 0,
    discount NUMERIC(10, 2) DEFAULT 0,
    customer_name TEXT,
    city TEXT,
    state TEXT,
    payment_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'created',
    items JSONB DEFAULT '[]'::jsonb,
    
    -- Ensure we don't duplicate orders for the same store by constraint
    UNIQUE(account_id, order_id)
);

-- Turn on row level security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert their own store's orders
-- (Assuming auth.uid() or similar matches account_id or is handled. 
-- For a simple MVP dashboard, we allow authenticated reads)
CREATE POLICY "Users can read orders" ON public.orders
    FOR SELECT USING (auth.role() = 'authenticated');

-- Edge Function (Service Role) will bypass RLS anyway.
