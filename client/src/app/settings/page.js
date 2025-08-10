"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { FaSave, FaKey, FaRobot, FaDocker, FaExclamationTriangle } from "react-icons/fa";

export default function Settings() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState({
        openai: "",
        anthropic: "",
        gemini: ""
    });
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Load existing API keys from localStorage or backend
        const savedKeys = localStorage.getItem('ai_api_keys');
        if (savedKeys) {
            setApiKeys(JSON.parse(savedKeys));
        }
    }, []);

    const handleKeyChange = (provider, value) => {
        setApiKeys(prev => ({
            ...prev,
            [provider]: value
        }));
        setSaved(false);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save to localStorage (in production, save to backend)
            localStorage.setItem('ai_api_keys', JSON.stringify(apiKeys));
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Error saving API keys:', error);
        } finally {
            setLoading(false);
        }
    };

    const maskApiKey = (key) => {
        if (!key) return "";
        if (key.length <= 8) return key;
        return key.substring(0, 4) + "..." + key.substring(key.length - 4);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Configure your AI API credentials and integration settings
                    </p>
                </div>

                <div className="space-y-8">
                    {/* AI API Keys Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center space-x-3">
                                <FaKey className="text-blue-500" />
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    AI API Credentials
                                </h2>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                Configure API keys for different AI providers used by AISensei
                            </p>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* OpenAI API Key */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    OpenAI API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={apiKeys.openai}
                                        onChange={(e) => handleKeyChange('openai', e.target.value)}
                                        placeholder="sk-..."
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Required for GPT-based grading and analysis features
                                </p>
                            </div>

                            {/* Anthropic API Key */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Anthropic API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={apiKeys.anthropic}
                                        onChange={(e) => handleKeyChange('anthropic', e.target.value)}
                                        placeholder="sk-ant-..."
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Required for Claude-based grading and detailed feedback
                                </p>
                            </div>

                            {/* Gemini API Key */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Google Gemini API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={apiKeys.gemini}
                                        onChange={(e) => handleKeyChange('gemini', e.target.value)}
                                        placeholder="AIza..."
                                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Required for Gemini-based evaluation and Vision API for OCR
                                </p>
                            </div>

                            {/* Save Button */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center space-x-2">
                                    {saved && (
                                        <span className="text-green-600 dark:text-green-400 text-sm">
                                            ✓ API keys saved successfully
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <FaSave />
                                    <span>{loading ? "Saving..." : "Save API Keys"}</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* MCP Integration Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center space-x-3">
                                <FaDocker className="text-blue-600" />
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    MCP Integration
                                </h2>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                Model Context Protocol for advanced AI capabilities
                            </p>
                        </div>
                        
                        <div className="p-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                                <div className="flex items-start space-x-3">
                                    <FaRobot className="text-blue-600 dark:text-blue-400 mt-1" />
                                    <div>
                                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                                            MCP Service Status
                                        </h3>
                                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                            The MCP service runs in a Docker container and provides enhanced AI capabilities 
                                            for complex grading tasks and educational content analysis.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">MCP Service</span>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Docker container status</p>
                                    </div>
                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-sm">
                                        Running
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">OCR Service</span>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Handwriting recognition via Google Vision</p>
                                    </div>
                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-sm">
                                        Active
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">AI Grading Pipeline</span>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Multi-model evaluation system</p>
                                    </div>
                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-sm">
                                        Ready
                                    </span>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white">Google Classroom Integration</span>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Sync classes, assignments, and students</p>
                                    </div>
                                    <button
                                        onClick={() => window.location.href = 'http://localhost:8000/api/v1/auth/login/google/classroom'}
                                        className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                    >
                                        Connect
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex items-start space-x-3">
                                    <FaRobot className="text-blue-600 dark:text-blue-400 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-blue-900 dark:text-blue-100">
                                            Google Classroom Integration
                                        </h4>
                                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                            Basic OAuth (login) works immediately. Google Classroom integration requires additional 
                                            permissions that may need Google verification in production. Click "Connect" above to enable 
                                            classroom features like syncing assignments and rosters.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                <div className="flex items-start space-x-3">
                                    <FaExclamationTriangle className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                    <div>
                                        <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                                            Setup Requirements
                                        </h4>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                            MCP services require Docker to be running. Make sure you have configured your API keys above 
                                            and that the Docker containers are started using the provided scripts.
                                        </p>
                                        <div className="mt-3">
                                            <code className="text-xs bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded">
                                                cd backend-python && ./run.sh
                                            </code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Current API Key Status */}
                    {Object.values(apiKeys).some(key => key) && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Configured API Keys
                                </h2>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {Object.entries(apiKeys).map(([provider, key]) => (
                                        key && (
                                            <div key={provider} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                                                        {provider}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                        {maskApiKey(key)}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}