-- Create daily_ad_spend table to store paid media costs
CREATE TABLE public.daily_ad_spend (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id TEXT NOT NULL,
    date DATE NOT NULL,
    platform TEXT NOT NULL,
    spend NUMERIC(10, 2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure we don't have duplicate entries for the same account, date and platform
    UNIQUE(account_id, date, platform)
);

-- Turn on row level security
ALTER TABLE public.daily_ad_spend ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read ad spend
CREATE POLICY "Users can read ad spend" ON public.daily_ad_spend
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update ad spend (optional, depending on who inserts)
CREATE POLICY "Users can insert ad spend" ON public.daily_ad_spend
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update ad spend" ON public.daily_ad_spend
    FOR UPDATE USING (auth.role() = 'authenticated');
