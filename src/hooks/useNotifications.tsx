import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState, useCallback, useRef } from 'react';

// ============================================
// TYPES
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export type NotificationFilter = 'all' | 'unread' | 'read';

// ============================================
// FETCH HOOKS
// ============================================

export function useNotifications(filter: NotificationFilter = 'all') {
  return useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'read') {
        query = query.eq('is_read', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Notification[];
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 10,
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return data as Notification;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      
      const previousAll = queryClient.getQueryData<Notification[]>(['notifications', 'all']);
      
      if (previousAll) {
        queryClient.setQueryData<Notification[]>(['notifications', 'all'], 
          previousAll.map(n => 
            n.id === notificationId 
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        );
      }
      
      return { previousAll };
    },
    onError: (err, notificationId, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(['notifications', 'all'], context.previousAll);
      }
      toast.error('Failed to mark notification as read');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkNotificationAsUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ 
          is_read: false, 
          read_at: null 
        })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return data as Notification;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      
      const previousAll = queryClient.getQueryData<Notification[]>(['notifications', 'all']);
      
      if (previousAll) {
        queryClient.setQueryData<Notification[]>(['notifications', 'all'], 
          previousAll.map(n => 
            n.id === notificationId 
              ? { ...n, is_read: false, read_at: undefined }
              : n
          )
        );
      }
      
      return { previousAll };
    },
    onError: (err, notificationId, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(['notifications', 'all'], context.previousAll);
      }
      toast.error('Failed to mark notification as unread');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      
      const previousAll = queryClient.getQueryData<Notification[]>(['notifications', 'all']);
      
      if (previousAll) {
        queryClient.setQueryData<Notification[]>(['notifications', 'all'], 
          previousAll.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
      }
      
      queryClient.setQueryData(['notifications', 'unread-count'], 0);
      
      return { previousAll };
    },
    onError: (err, variables, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(['notifications', 'all'], context.previousAll);
      }
      toast.error('Failed to mark all as read');
    },
    onSuccess: () => {
      toast.success('All notifications marked as read');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return notificationId;
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      
      const previousAll = queryClient.getQueryData<Notification[]>(['notifications', 'all']);
      const previousUnread = queryClient.getQueryData<Notification[]>(['notifications', 'unread']);
      const previousRead = queryClient.getQueryData<Notification[]>(['notifications', 'read']);
      
      if (previousAll) {
        queryClient.setQueryData<Notification[]>(
          ['notifications', 'all'], 
          previousAll.filter(n => n.id !== notificationId)
        );
      }
      if (previousUnread) {
        queryClient.setQueryData<Notification[]>(
          ['notifications', 'unread'], 
          previousUnread.filter(n => n.id !== notificationId)
        );
      }
      if (previousRead) {
        queryClient.setQueryData<Notification[]>(
          ['notifications', 'read'], 
          previousRead.filter(n => n.id !== notificationId)
        );
      }
      
      const deletedNotification = previousAll?.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.is_read) {
        const currentCount = queryClient.getQueryData<number>(['notifications', 'unread-count']) || 0;
        queryClient.setQueryData(['notifications', 'unread-count'], Math.max(0, currentCount - 1));
      }
      
      return { previousAll, previousUnread, previousRead };
    },
    onError: (err, notificationId, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(['notifications', 'all'], context.previousAll);
      }
      if (context?.previousUnread) {
        queryClient.setQueryData(['notifications', 'unread'], context.previousUnread);
      }
      if (context?.previousRead) {
        queryClient.setQueryData(['notifications', 'read'], context.previousRead);
      }
      toast.error('Failed to delete notification');
    },
    onSuccess: () => {
      toast.success('Notification deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useClearAllNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      
      const previousAll = queryClient.getQueryData<Notification[]>(['notifications', 'all']);
      
      queryClient.setQueryData(['notifications', 'all'], []);
      queryClient.setQueryData(['notifications', 'unread'], []);
      queryClient.setQueryData(['notifications', 'read'], []);
      queryClient.setQueryData(['notifications', 'unread-count'], 0);
      
      return { previousAll };
    },
    onError: (err, variables, context) => {
      if (context?.previousAll) {
        queryClient.setQueryData(['notifications', 'all'], context.previousAll);
      }
      toast.error('Failed to clear notifications');
    },
    onSuccess: () => {
      toast.success('All notifications cleared');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ============================================
// ADVANCED REAL-TIME SUBSCRIPTION HOOK
// ============================================

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateCache = useCallback((event: string, payload: any) => {
    const notification = payload.new as Notification | null;
    const oldNotification = payload.old as Notification | null;

    switch (event) {
      case 'INSERT':
        if (notification) {
          queryClient.setQueryData<Notification[]>(['notifications', 'all'], (old = []) => {
            if (old.some(n => n.id === notification.id)) return old;
            return [notification, ...old];
          });
          
          if (!notification.is_read) {
            queryClient.setQueryData<Notification[]>(['notifications', 'unread'], (old = []) => {
              if (old.some(n => n.id === notification.id)) return old;
              return [notification, ...old];
            });
            
            queryClient.setQueryData<number>(['notifications', 'unread-count'], (old = 0) => old + 1);
          }
          
          toast[notification.type || 'info'](notification.title, {
            description: notification.message,
            duration: 5000,
          });
        }
        break;

      case 'UPDATE':
        if (notification) {
          queryClient.setQueryData<Notification[]>(['notifications', 'all'], (old = []) =>
            old.map(n => n.id === notification.id ? notification : n)
          );
          
          if (notification.is_read) {
            queryClient.setQueryData<Notification[]>(['notifications', 'unread'], (old = []) =>
              old.filter(n => n.id !== notification.id)
            );
            queryClient.setQueryData<Notification[]>(['notifications', 'read'], (old = []) => {
              if (old.some(n => n.id === notification.id)) {
                return old.map(n => n.id === notification.id ? notification : n);
              }
              return [notification, ...old];
            });
          } else {
            queryClient.setQueryData<Notification[]>(['notifications', 'read'], (old = []) =>
              old.filter(n => n.id !== notification.id)
            );
            queryClient.setQueryData<Notification[]>(['notifications', 'unread'], (old = []) => {
              if (old.some(n => n.id === notification.id)) {
                return old.map(n => n.id === notification.id ? notification : n);
              }
              return [notification, ...old];
            });
          }
          
          queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        }
        break;

      case 'DELETE':
        const deletedId = oldNotification?.id || payload.old?.id;
        if (deletedId) {
          queryClient.setQueryData<Notification[]>(['notifications', 'all'], (old = []) =>
            old.filter(n => n.id !== deletedId)
          );
          queryClient.setQueryData<Notification[]>(['notifications', 'unread'], (old = []) =>
            old.filter(n => n.id !== deletedId)
          );
          queryClient.setQueryData<Notification[]>(['notifications', 'read'], (old = []) =>
            old.filter(n => n.id !== deletedId)
          );
          
          if (oldNotification && !oldNotification.is_read) {
            queryClient.setQueryData<number>(['notifications', 'unread-count'], (old = 0) => 
              Math.max(0, old - 1)
            );
          }
        }
        break;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!userId) return;

    const setupChannel = () => {
      setConnectionStatus('connecting');

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`notifications-realtime-${userId}-${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => updateCache('INSERT', payload)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => updateCache('UPDATE', payload)
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => updateCache('DELETE', payload)
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            reconnectAttempts.current = 0;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setConnectionStatus('disconnected');
            
            if (reconnectAttempts.current < maxReconnectAttempts) {
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
              reconnectAttempts.current++;
              setTimeout(setupChannel, delay);
            }
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, updateCache]);

  return { connectionStatus };
}
