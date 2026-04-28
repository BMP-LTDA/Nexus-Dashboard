import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const GA4Context = createContext({ hasGA4: false, gaPropertyId: null, loading: true });

export function GA4Provider({ currentAccount, children }) {
  const [hasGA4, setHasGA4] = useState(false);
  const [gaPropertyId, setGaPropertyId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkGA4() {
      if (!currentAccount) {
        setHasGA4(false);
        setGaPropertyId(null);
        setLoading(false);
        return;
      }

      try {
        const slug = typeof currentAccount === 'string' ? currentAccount : currentAccount.id;
        const { data, error } = await supabase
          .from('accounts')
          .select('ga_property_id')
          .eq('slug', slug)
          .single();

        if (!error && data?.ga_property_id) {
          setHasGA4(true);
          setGaPropertyId(data.ga_property_id);
        } else {
          setHasGA4(false);
          setGaPropertyId(null);
        }
      } catch (err) {
        console.error('[GA4Context] Error checking GA4 config:', err);
        setHasGA4(false);
        setGaPropertyId(null);
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    checkGA4();
  }, [currentAccount]);

  return (
    <GA4Context.Provider value={{ hasGA4, gaPropertyId, loading }}>
      {children}
    </GA4Context.Provider>
  );
}

export function useGA4() {
  return useContext(GA4Context);
}
