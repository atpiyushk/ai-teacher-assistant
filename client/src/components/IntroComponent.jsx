"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
    FaRobot, 
    FaBolt, 
    FaChartLine, 
    FaClipboardCheck,
    FaUsers,
    FaArrowRight,
    FaPlay,
    FaGraduationCap
} from "react-icons/fa";

export default function IntroComponent() {
    const router = useRouter();
    const { loggedIn } = useAuth();

    const scrollToFeatures = () => {
        document
            .getElementById("features-section")
            ?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <>
            {/* Hero Section */}
            <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent transform -skew-y-12"></div>
                </div>
                
                <div className="relative flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 text-center">
                    <div className="max-w-5xl mx-auto">

                        {/* Main Heading */}
                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
                            Grade Smarter, 
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                {" "}Teach Better
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
                            Automate assignment grading with AI. Extract text from PDFs, 
                            generate personalized feedback, and focus on what matters most - teaching.
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                            {loggedIn ? (
                                <button
                                    onClick={() => router.push("/dashboard")}
                                    className="group flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                >
                                    Go to Dashboard
                                    <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </button>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button
                                        onClick={() => router.push("/login")}
                                        className="group flex items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                    >
                                        Teacher Login
                                        <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <button
                                        onClick={() => router.push("/student-login")}
                                        className="group flex items-center px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                                    >
                                        Student Portal
                                        <FaArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={scrollToFeatures}
                                className="flex items-center px-8 py-4 border-2 border-gray-300 text-gray-300 hover:text-white hover:border-white font-semibold rounded-lg transition-all duration-300"
                            >
                                <FaPlay className="mr-2 text-sm" />
                                See How It Works
                            </button>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-blue-400">45%</div>
                                <div className="text-gray-400">Time Saved</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-purple-400">AI-Powered</div>
                                <div className="text-gray-400">OCR & Grading</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-400">Instant</div>
                                <div className="text-gray-400">Feedback</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div id="features-section" className="py-20 bg-gray-50 dark:bg-gray-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Powerful Features for Modern Educators
                        </h2>
                        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
                            Built for teachers who want to focus on teaching, not grading
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mb-4">
                                <FaRobot className="text-blue-600 dark:text-blue-400 text-xl" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                AI Auto-Grading
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Intelligent grading system that understands context and provides detailed feedback on student submissions.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg mb-4">
                                <FaClipboardCheck className="text-purple-600 dark:text-purple-400 text-xl" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                PDF OCR Processing
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Extract text from handwritten or printed assignments and automatically grade them.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg mb-4">
                                <FaChartLine className="text-green-600 dark:text-green-400 text-xl" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Analytics Dashboard
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Track student performance, identify learning gaps, and get insights to improve your teaching.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg mb-4">
                                <FaUsers className="text-orange-600 dark:text-orange-400 text-xl" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Classroom Management
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Organize students, assignments, and grades in one intuitive interface designed for educators.
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg mb-4">
                                <FaBolt className="text-red-600 dark:text-red-400 text-xl" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Instant Feedback
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Provide immediate, personalized feedback to help students learn and improve faster.
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg mb-4">
                                <FaGraduationCap className="text-indigo-600 dark:text-indigo-400 text-xl" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Student Dashboard
                            </h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Students can see their grades of assignment and personalized feedback to improve their weak areas.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                        Ready to Transform Your Teaching?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Join us to be a smart educator and save hours of grading time.
                    </p>
                    {!loggedIn && (
                        <button
                            onClick={() => router.push("/register")}
                            className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                            Get Started
                            <FaArrowRight className="ml-2" />
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}
