'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const token = apiClient.getAccessToken();
      
      if (token) {
        const userData = await apiClient.getCurrentUser();
        setUser(userData);
        apiClient.setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
      apiClient.clearTokens();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      console.log('Login attempt started for:', email);
      
      const result = await apiClient.login(email, password);
      console.log('Login result:', result);
      
      if (result.success) {
        setUser(result.user);
        console.log('Login successful, redirecting to dashboard');
        router.push('/dashboard');
        return { success: true };
      } else {
        console.log('Login failed:', result.error);
        setError(result.error || 'Login failed');
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error.message || 'An unexpected error occurred';
      console.error('Login error:', error);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setError(null);
      setLoading(true);
      
      const result = await apiClient.register({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        school: userData.school || '',
        phone: userData.phone || ''
      });
      
      if (result.success) {
        if (result.user) {
          setUser(result.user);
          router.push('/dashboard');
        } else {
          router.push('/login');
        }
        return { success: true };
      } else {
        setError(result.error || 'Registration failed');
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errorMessage = error.message || 'An unexpected error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await apiClient.logout();
      setUser(null);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      apiClient.clearTokens();
      setUser(null);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = () => {
    try {
      console.log('Initiating Google OAuth login...');
      apiClient.loginWithGoogle();
    } catch (error) {
      console.error('Error initiating Google login:', error);
      setError('Failed to initiate Google login');
    }
  };

  const updateUser = async () => {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      apiClient.setUser(userData);
      return userData;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    loginWithGoogle,
    updateUser,
    checkAuth,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};