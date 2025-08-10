"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaGoogle, FaGraduationCap } from "react-icons/fa";

export default function StudentLogin() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleGoogleLogin = () => {
        setIsLoading(true);
        setError("");
        console.log('Student Google login initiated');
        
        // Direct to student-specific Google OAuth endpoint
        window.location.href = 'http://localhost:8000/api/v1/auth/student/login/google';
    };

    // Check if user is already authenticated as student
    useEffect(() => {
        const checkStudentAuth = () => {
            const studentData = localStorage.getItem('student_data');
            if (studentData) {
                router.push('/student-portal');
            }
        };
        checkStudentAuth();
    }, [router]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-blue-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="relative h-32 bg-gradient-to-r from-blue-600 to-purple-600 pt-8">
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white"></div>
                            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white"></div>
                        </div>
                        <div className="text-center">
                            <FaGraduationCap className="mx-auto text-4xl text-white mb-2" />
                            <h1 className="text-2xl font-bold text-white">Student Portal</h1>
                            <p className="text-blue-100 mt-1 opacity-90">Access your grades and feedback</p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-8">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                                <p className="text-red-600 dark:text-red-400 text-sm text-center">
                                    {error}
                                </p>
                            </div>
                        )}

                        <div className="text-center mb-8">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Sign in to view your progress
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                Use your school Google account to access your assignments, grades, and feedback
                            </p>
                        </div>

                        <button
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="w-full h-14 flex items-center justify-center px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <FaGoogle className="mr-3 text-xl" />
                                    Sign in with Google
                                </>
                            )}
                        </button>

                        <div className="mt-8 text-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                🔒 Secure login with your school account
                            </div>
                            
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    Are you a teacher?
                                </p>
                                <Link 
                                    href="/login" 
                                    className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                                >
                                    Teacher Login →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                        What you'll find in your portal:
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                            View your assignment grades and scores
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                            Read detailed feedback from teachers
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                            Track your progress across all classes
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3"></div>
                            Access AI-powered learning insights
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}