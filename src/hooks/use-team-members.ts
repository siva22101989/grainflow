import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from "@/hooks/use-local-storage";
import { fetchTeamMembers } from '@/lib/actions/auth';
import { createClient } from '@/utils/supabase/client';
import { logError } from '@/lib/error-logger';

const CACHE_KEY = 'rent_team_members_v3'; // Changed to force refresh after schema update
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Hours

export function useTeamMembers() {
    const [teamCache, setTeamCache] = useLocalStorage<any>(CACHE_KEY, null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const cacheRef = useRef(teamCache);
    useEffect(() => {
        cacheRef.current = teamCache;
    }, [teamCache]);

    const refreshMembers = useCallback(async () => {
        setLoading(true);
        try {
            const teamData = await fetchTeamMembers();
            setTeamCache({ 
                data: teamData, 
                timestamp: Date.now() 
            });
            setMembers(teamData || []);
        } catch(e) {
             logError(e, { operation: 'useTeamMembers.refresh' });
        } finally {
            setLoading(false);
        }
    }, [setTeamCache]);

    const refreshRef = useRef(refreshMembers);
    useEffect(() => {
        refreshRef.current = refreshMembers;
    }, [refreshMembers]);

    // 1. Initial Load from Cache
    useEffect(() => {
        async function load() {
            try {
                const currentCache = cacheRef.current;
                let teamData = null;
                if (currentCache) {
                    const { data, timestamp } = currentCache;
                    if (data && timestamp && (Date.now() - timestamp < CACHE_DURATION)) {
                        teamData = data;
                    }
                }

                if (!teamData) {
                    teamData = await fetchTeamMembers();
                    setTeamCache({ 
                        data: teamData, 
                        timestamp: Date.now() 
                    });
                }
                setMembers(teamData || []);
            } catch (e) {
                logError(e, { operation: 'useTeamMembers.load' });
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [setTeamCache]);

    // 2. Auth Listener
    useEffect(() => {
        const supabase = createClient();
        let lastSessionId: string | null = null;

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const currentSessionId = session?.user?.id || null;
            
            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (currentSessionId !== lastSessionId) {
                    lastSessionId = currentSessionId;
                    refreshRef.current();
                }
            } else if (event === 'SIGNED_OUT') {
                lastSessionId = null;
                setMembers([]);
                setTeamCache(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [setTeamCache]);

    return { members, loading, refreshMembers };
}
