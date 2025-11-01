import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeSubscription(
  table: string,
  callback: (payload: any) => void,
  filter?: { column: string; value: any }
) {
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = () => {
      let subscription = supabase
        .channel(`${table}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
          },
          (payload) => {
            console.log(`Realtime update on ${table}:`, payload);
            callback(payload);
          }
        );

      channel = subscription.subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [table, filter?.column, filter?.value]);
}

/**
 * Subscribe to session transcript updates
 */
export function useTranscriptUpdates(
  sessionId: string,
  onUpdate: (transcript: any) => void
) {
  useRealtimeSubscription(
    'session_transcripts',
    (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        onUpdate(payload.new);
      }
    },
    { column: 'session_id', value: sessionId }
  );
}

/**
 * Subscribe to task updates
 */
export function useTaskUpdates(userId: string, onUpdate: (task: any) => void) {
  useRealtimeSubscription(
    'tasks',
    (payload) => {
      if (payload.new) {
        onUpdate(payload.new);
      }
    },
    { column: 'user_id', value: userId }
  );
}

/**
 * Subscribe to notification updates
 */
export function useNotificationUpdates(
  userId: string,
  onUpdate: (notification: any) => void
) {
  useRealtimeSubscription(
    'notifications',
    (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        onUpdate(payload.new);
      }
    },
    { column: 'user_id', value: userId }
  );
}

/**
 * Subscribe to session updates
 */
export function useSessionUpdates(
  sessionId: string,
  onUpdate: (session: any) => void
) {
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`session-${sessionId}-changes`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Session real-time update received:', payload);
          if (payload.new) {
            onUpdate(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, onUpdate]);
}
