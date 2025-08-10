"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const StudentFeedback = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new student login page
    router.push("/student-login");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
    </div>
  );
};

export default StudentFeedback;