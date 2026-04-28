import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useFilter } from '../contexts/FilterContext';
import { setOrdersCache } from '../data/mockData';
import { ordersService } from '../services/orders';

export function useRealtimeOrders(currentAccountSlug) {
  const { refreshData } = useFilter();

  const refreshRef = useRef(refreshData);
  useEffect(() => { refreshRef.current = refreshData; }, [refreshData]);

  // Core fetch: pulls orders from Supabase → writes to in-memory cache → triggers re-render
  const loadFromSupabase = useCallback(async (slug) => {
    if (!slug) return;
    try {
      // 1. Resolve Account UUID
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', slug)
        .single();

      if (accountError || !accountData) {
        console.warn(`[useRealtimeOrders] Account not found for slug: ${slug}`);
        return;
      }
      const accountId = accountData.id;

      // 2. Fetch all orders for this account (bypass 1000 limit)
      const orders = await ordersService.fetchAllOrders(
        accountId, 
        null, 
        null, 
        'id, external_order_id, amount, payment_status, status, created_at, customer_name, items'
      );

      // 3. Map to the format that mockData functions expect
      const formattedOrders = (orders || []).map(o => ({
        id: o.external_order_id || o.id,
        total: Number(o.amount) || Number(o.total) || 0,
        paymentStatus: o.payment_status || 'approved',
        status: o.status || 'invoiced',
        createdAt: o.created_at,
        customerName: o.customer_name || 'Desconhecido',
        items: o.items || []
      }));

      // 4. Write to in-memory cache and trigger UI re-render
      setOrdersCache(slug, formattedOrders);
      refreshRef.current();

    } catch (err) {
      console.error('[useRealtimeOrders] Error fetching orders:', err);
    }
  }, []);

  // Expose a manual refetch so Settings.jsx can call it after CSV upsert
  // We store the function in a module-level map so other components can access it
  useEffect(() => {
    if (!currentAccountSlug) return;

    // Initial fetch on mount / account change
    loadFromSupabase(currentAccountSlug);

    // Set up Realtime subscription
    let subscription = null;

    const setupRealtime = async () => {
      const { data: accountData } = await supabase
        .from('accounts')
        .select('id')
        .eq('slug', currentAccountSlug)
        .single();

      if (!accountData) return;

      subscription = supabase
        .channel(`orders:${accountData.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `account_id=eq.${accountData.id}`
        }, () => {
          // Debounced refetch on any change (new order from webhook, etc.)
          loadFromSupabase(currentAccountSlug);
        })
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, [currentAccountSlug, loadFromSupabase]);

  return { refetch: () => loadFromSupabase(currentAccountSlug) };
}
