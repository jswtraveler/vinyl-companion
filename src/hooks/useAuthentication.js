import { useState, useEffect } from 'react';
import { supabase } from '../services/database/supabaseClient';

/**
 * Custom hook for handling authentication state and operations
 *
 * @returns {Object} Authentication state and methods
 * @returns {Object|null} user - Current authenticated user
 * @returns {boolean} authLoading - Whether auth is initializing
 * @returns {boolean} useCloudDatabase - Whether to use cloud storage
 * @returns {Function} handleSignIn - Function to trigger sign-in modal
 * @returns {Function} handleSignOut - Function to sign out current user
 */
export function useAuthentication() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [useCloudDatabase, setUseCloudDatabase] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth session error:', error);
        } else if (session?.user) {
          console.log('User already logged in:', session.user.email);
          setUser(session.user);
          setUseCloudDatabase(true);
        } else {
          console.log('No active session - using local database');
          setUseCloudDatabase(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setUseCloudDatabase(true);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUseCloudDatabase(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      alert('Signed out successfully!');
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out: ' + error.message);
    }
  };

  return {
    user,
    authLoading,
    useCloudDatabase,
    handleSignOut
  };
}
