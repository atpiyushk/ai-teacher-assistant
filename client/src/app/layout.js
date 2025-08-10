"use client";
import React, { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { FiMessageSquare, FiMail, FiMapPin } from "react-icons/fi"; 
import Header from "../components/elements/Header";
import "./globals.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Background from "@/components/Background";
import { DarkModeProvider, useDarkMode } from "@/context/DarkModeContext";
import { UserProvider } from "@/context/UserContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

function ThemedLayout({ children }) {
    const { darkMode } = useDarkMode();
    const theme = darkMode ? "dark" : "light";
    const [showScrollButton, setShowScrollButton] = useState(false);
    const { isAuthenticated: loggedIn } = useAuth();
    const router = useRouter();
    const scrollToAbout = () => {
        document
            .getElementById("about-section")
            ?.scrollIntoView({ behavior: "smooth" });
    };
    const scrollToTeam = () => {
        document
            .getElementById("team-section")
            ?.scrollIntoView({ behavior: "smooth" });   
    };

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollButton(window.scrollY > 200);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollUp = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <>
            <head>
                <link
                    rel="apple-touch-icon"
                    sizes="180x180"
                    href="/apple-touch-icon.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="32x32"
                    href="/favicon-32x32.png"
                />
                <link
                    rel="icon"
                    type="image/png"
                    sizes="16x16"
                    href="/favicon-16x16.png"
                />
                <link rel="manifest" href="./manifest.js" />
                <title>
                    {loggedIn
                        ? "Dashboard - AISensei"
                        : "Welcome to AISensei"}
                </title>
                <meta
                    name="description"
                    content={
                        loggedIn
                            ? "Access your AI-powered grading dashboard."
                            : "AISensei helps teachers automate grading and provide personalized feedback."
                    }
                />
                <meta
                    name="keywords"
                    content="AI grading, automated feedback, teacher assistant, student evaluation"
                />
                <meta
                    property="og:title"
                    content={
                        loggedIn
                            ? "Dashboard - AISensei"
                            : "Welcome to AISensei"
                    }
                />
                <meta
                    property="og:description"
                    content={
                        loggedIn
                            ? "Access your AI-powered grading dashboard."
                            : "AISensei helps teachers automate grading and provide personalized feedback."
                    }
                />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://www.aisensei.app/" />
                <meta
                    property="og:image"
                    content="https://www.aisensei.app/favicon.ico"
                />
                <meta name="robots" content="index, follow" />
            </head>
            <body className={`${theme}-mode quicksand ${theme} relative`}>
                <Background />
                <div className="min-h-screen flex flex-col">
                    <Header dashboard={true} />
                    <main className="flex-grow">{children}</main>
                    {/* Footer Section */}
                    <footer className="bg-gradient-to-br from-gray-900 to-gray-800 text-gray-200 px-6 shadow-2xl relative">

                    {/* Divider and Copyright */}
                    <div className="text-center mt-6 mb-4 text-gray-400">
                        {/* <div className="h-0.5 w-3/5 mx-auto mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"></div> */}
                        © {new Date().getFullYear()} AISensei. All Rights Reserved.
                    </div>
                    </footer>

                    {showScrollButton && (
                        <>
                            {/* Scroll Up Button */}
                            <div className="fixed bottom-8 right-8">
                                <button
                                    onClick={scrollUp}
                                    className={`p-3 rounded-full shadow-lg transition ${
                                        darkMode
                                            ? "bg-gray-800 text-white hover:bg-gray-700"
                                            : "bg-gray-200 text-black hover:bg-gray-300"
                                    }`}
                                    title="Scroll to Top"
                                >
                                    <ChevronUp size={24} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </body>
        </>
    );
}

const Layout = ({ children }) => {
    return (
        <html lang="en">
            <DarkModeProvider>
                <AuthProvider>
                    <UserProvider>
                        <ThemedLayout>{children}</ThemedLayout>
                    </UserProvider>
                </AuthProvider>
            </DarkModeProvider>
        </html>
    );
};

export default Layout;
