"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash, FaGoogle } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
    const router = useRouter();
    const { user, register, loginWithGoogle, error: authError, loading } = useAuth();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        if (user) {
            router.push("/dashboard");
        }
    }, [user, router]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name) newErrors.name = "Name is required";
        if (!formData.email) {
            newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Invalid email address";
        }
        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (formData.password.length < 6) {
            newErrors.password = "Password must be at least 6 characters";
        }
        if (formData.password !== confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setErrors({});
        setIsLoading(true);

        try {
            const result = await register({
                name: formData.name,
                email: formData.email,
                password: formData.password,
            });

            if (!result.success) {
                setErrors({ general: result.error || 'Registration failed. Please try again.' });
            }
        } catch (error) {
            setErrors({ general: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleRegister = () => {
        console.log('Google register button clicked');
        // Since OAuth is properly configured, redirect directly to Google
        window.location.href = 'http://localhost:8000/api/v1/auth/login/google';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#1D2F6F]"></div>
            </div>
        );
    }

    return (
        <>
        {/* Force prevent default eye option in MS Edge */}
        <style jsx global> {`
            ::-ms-reveal {
                display: none;
            }
        `}</style>
            <div className="flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 pt-20 pb-10">
                <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg bg-sky-100 dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transform transition-all">
                    {/* Header with decorative accents */}
                    <div className="relative h-24 bg-gradient-to-r from-[#1D2F6F] to-[#3D5BF5] dark:from-[#283A6D] dark:to-[#5B7BFF]">
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-white"></div>
                            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white"></div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 text-center pb-4">
                            <h1 className="text-2xl font-bold text-white">Create Account</h1>
                        </div>
                    </div>
                    
                    <div className="p-8 pt-6">
                        {(authError || errors.general) && (
                            <div className="mb-6 py-2 px-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-r">
                                <p className="text-red-600 dark:text-red-400 text-sm">
                                    {authError || errors.general}
                                </p>
                            </div>
                        )}
                        
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Full Name Field */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Full Name</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        className={`block w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                                            errors.name 
                                                ? "border-red-500 focus:ring-red-200 dark:focus:ring-red-900" 
                                                : "border-gray-200 dark:border-gray-600 focus:border-[#1D2F6F] focus:ring-[#1D2F6F]/20 dark:focus:border-[#FAC748] dark:focus:ring-[#FAC748]/20"
                                        }`}
                                        placeholder="John Doe"
                                    />
                                    {errors.name && <span className="absolute right-3 top-3 text-red-500">!</span>}
                                </div>
                                {errors.name && <p className="text-red-500 text-sm mt-1 ml-1">{errors.name}</p>}
                            </div>
                            
                            {/* Email Field */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        className={`block w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                                            errors.email 
                                                ? "border-red-500 focus:ring-red-200 dark:focus:ring-red-900" 
                                                : "border-gray-200 dark:border-gray-600 focus:border-[#1D2F6F] focus:ring-[#1D2F6F]/20 dark:focus:border-[#FAC748] dark:focus:ring-[#FAC748]/20"
                                        }`}
                                        placeholder="name@email.com"
                                    />
                                    {errors.email && <span className="absolute right-3 top-3 text-red-500">!</span>}
                                </div>
                                {errors.email && <p className="text-red-500 text-sm mt-1 ml-1">{errors.email}</p>}
                            </div>
                            
                            {/* Password Field */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        autoComplete="new-password"
                                        spellCheck="false"
                                        required
                                        className={`block w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                                            errors.password 
                                                ? "border-red-500 focus:ring-red-200 dark:focus:ring-red-900" 
                                                : "border-gray-200 dark:border-gray-600 focus:border-[#1D2F6F] focus:ring-[#1D2F6F]/20 dark:focus:border-[#FAC748] dark:focus:ring-[#FAC748]/20"
                                        }`}
                                        placeholder="Password"
                                    />
                                    {errors.password && <span className="absolute right-10 top-3 text-red-500">!</span>}
                                    {formData.password && (
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="absolute inset-y-0 right-3 flex items-center focus:outline-none"
                                        >
                                            {showPassword ? (<FaEyeSlash className="text-gray-500" />) : (<FaEye className="text-gray-500" />)}
                                        </button>
                                    )}
                                </div>
                                {errors.password && <p className="text-red-500 text-sm mt-1 ml-1">{errors.password}</p>}
                            </div>
                            {/* confirm password field */}
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        name="confirmPassword"
                                        id="confirmPassword"
                                        value={confirmPassword}
                                        autoComplete="new-password"
                                        spellCheck="false"
                                        onChange={(e) => {
                                            setConfirmPassword(e.target.value);
                                            if (errors.confirmPassword) {
                                                setErrors({...errors, confirmPassword: ""});
                                            }
                                        }}
                                        required
                                        className={`block w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all duration-200 ${
                                            errors.confirmPassword
                                                ? "border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-900"
                                                : "border-gray-200 dark:border-gray-600 focus:border-[#1D2F6F] focus:ring-[#1D2F6F]/20 dark:focus:border-[#FAC748] dark:focus:ring-[#FAC748]/20"
                                        }`}
                                        placeholder="Confirm Password"
                                    />
                                    {confirmPassword && (
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                                            className="absolute inset-y-0 right-3 flex items-center focus:outline-none"
                                        >
                                            {showConfirmPassword ? (<FaEyeSlash className="text-gray-500" />) : (<FaEye className="text-gray-500" />)}
                                        </button>
                                    )}
                                </div>
                                {errors.confirmPassword && <p className="text-red-500 text-sm mt-1 ml-1">{errors.confirmPassword}</p>}
                            </div>
                            
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isLoading || loading}
                                    className={`w-full py-3.5 px-4 bg-gradient-to-r from-[#1D2F6F] to-[#3D5BF5] dark:from-[#FAC748] dark:to-[#FFD97D] text-white dark:text-gray-800 font-semibold rounded-xl shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/50 dark:focus:ring-[#FAC748]/50 ${
                                        (isLoading || loading) ? "opacity-70 cursor-not-allowed" : ""
                                    }`}
                                >
                                    {(isLoading || loading) ? (
                                        <span className="flex items-center justify-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white dark:text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Creating Account...
                                        </span>
                                    ) : (
                                        "Create Account"
                                    )}
                                </button>
                            </div>

                            {/* Google OAuth Button */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-sky-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                        Or continue with
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={handleGoogleRegister}
                                className="w-full h-12 flex items-center justify-center px-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/50 dark:focus:ring-[#FAC748]/50 transition-all duration-200"
                            >
                                <FaGoogle className="mr-3 text-red-500" />
                                Sign up with Google
                            </button>
                        </form>
                        
                        <div className="mt-6 text-center">
                            <p className="text-gray-600 dark:text-gray-400">
                                Already have an account?{" "}
                                <a href="/login"
                                    className="font-medium text-[#1D2F6F] dark:text-[#FAC748] hover:text-[#3D5BF5] dark:hover:text-[#FFD97D] transition-colors"
                                >
                                    Sign in
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}