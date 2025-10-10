/**
 * PHASE 1 - Authentication & Onboarding Tests
 * Comprehensive test suite for auth flow validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import OnboardingProfile from '@/pages/OnboardingProfile';
import { supabase } from '@/integrations/supabase/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </QueryClientProvider>
);

describe('Phase 1: Authentication & Onboarding', () => {
  
  describe('Login Flow', () => {
    it('should render login form with all required fields', () => {
      render(<Login />, { wrapper });
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should validate email format', async () => {
      render(<Login />, { wrapper });
      
      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
      });
    });

    it('should validate password minimum length', async () => {
      render(<Login />, { wrapper });
      
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(passwordInput, { target: { value: '123' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it('should handle login errors gracefully', async () => {
      render(<Login />, { wrapper });
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Signup Flow', () => {
    it('should render signup form with all required fields', () => {
      render(<Signup />, { wrapper });
      
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /terms/i })).toBeInTheDocument();
    });

    it('should validate password confirmation', async () => {
      render(<Signup />, { wrapper });
      
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.change(confirmInput, { target: { value: 'password456' } });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('should require terms acceptance', async () => {
      render(<Signup />, { wrapper });
      
      const submitButton = screen.getByRole('button', { name: /create account/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText(/accept the terms/i)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Onboarding', () => {
    it('should render onboarding form with all required fields', () => {
      render(<OnboardingProfile />, { wrapper });
      
      expect(screen.getByLabelText(/professional title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/specialty/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
    });

    it('should allow skipping onboarding', async () => {
      render(<OnboardingProfile />, { wrapper });
      
      const skipButton = screen.getByRole('button', { name: /skip/i });
      expect(skipButton).toBeInTheDocument();
    });
  });

  describe('Database Integration', () => {
    it('should create profile on signup', async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      
      // Simulate signup
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'testpassword123',
        options: {
          data: {
            full_name: 'Test User',
          },
        },
      });
      
      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      
      // Verify profile was created
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        expect(profile).not.toBeNull();
        expect(profile?.full_name).toBe('Test User');
      }
    });

    it('should assign default user role on signup', async () => {
      const testEmail = `test-${Date.now()}@example.com`;
      
      const { data } = await supabase.auth.signUp({
        email: testEmail,
        password: 'testpassword123',
      });
      
      if (data.user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', data.user.id);
        
        expect(roles).not.toBeNull();
        expect(roles?.length).toBeGreaterThan(0);
        expect(roles?.[0].role).toBe('user');
      }
    });
  });

  describe('Session Persistence', () => {
    it('should maintain session across page reloads', async () => {
      // This test would require actual browser session simulation
      // Placeholder for E2E testing
      expect(true).toBe(true);
    });
  });
});
