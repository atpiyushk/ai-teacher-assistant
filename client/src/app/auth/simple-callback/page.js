"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SimpleAuthCallback() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const error = searchParams.get('error');

        if (error) {
            console.error('OAuth error:', error);
            router.push('/login?error=oauth_failed');
            return;
        }

        if (accessToken && refreshToken) {
            // Store tokens directly
            localStorage.setItem('aisensei_access_token', accessToken);
            localStorage.setItem('aisensei_refresh_token', refreshToken);
            
            // Redirect to dashboard immediately
            router.push('/dashboard');
        } else {
            console.error('No tokens received from OAuth callback');
            router.push('/login?error=oauth_failed');
        }
    }, [searchParams, router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Completing sign in...
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                    Please wait while we sign you in with Google.
                </p>
            </div>
        </div>
    );
}