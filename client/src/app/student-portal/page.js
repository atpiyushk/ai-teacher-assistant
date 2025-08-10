"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaGraduationCap,
  FaCheckCircle,
  FaClock,
  FaChartLine,
  FaComments,
  FaAward,
  FaExclamationTriangle,
  FaSignOutAlt,
  FaTrophy,
  FaCalendarAlt,
  FaFileAlt,
  FaChalkboardTeacher
} from "react-icons/fa";
import apiClient from "@/lib/api-client";

const StudentPortal = () => {
  const [student, setStudent] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    gradedAssignments: 0,
    averageGrade: 0,
    recentGrade: null
  });
  const router = useRouter();

  useEffect(() => {
    const checkStudentAuth = () => {
      // Check if student is authenticated via Google OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const studentData = urlParams.get('student_data');
      const token = urlParams.get('token');
      
      if (studentData && token) {
        try {
          // Parse the student_data from the URL
          const parsedStudent = JSON.parse(decodeURIComponent(studentData));
          
          // Store student data and token
          localStorage.setItem('student_data', JSON.stringify(parsedStudent));
          localStorage.setItem('student_token', token);
          
          // Set the student state
          setStudent(parsedStudent);
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Load student assignments
          loadStudentData(parsedStudent.email);
          return;
        } catch (err) {
          console.error('Error parsing student data from URL:', err);
        }
      }
      
      // Check if student data exists in localStorage
      const storedStudentData = localStorage.getItem('student_data');
      const storedToken = localStorage.getItem('student_token');
      
      if (storedStudentData && storedToken) {
        try {
          const parsedStudent = JSON.parse(storedStudentData);
          setStudent(parsedStudent);
          loadStudentData(parsedStudent.email);
        } catch (err) {
          console.error('Error parsing student data:', err);
          redirectToLogin();
        }
      } else {
        redirectToLogin();
      }
    };
    
    checkStudentAuth();
  }, []);

  const redirectToLogin = () => {
    router.push('/student-login');
  };

  const loadStudentData = async (studentEmail) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch student's assignments and grades using the new endpoint
      const response = await apiClient.get(`/api/v1/students/feedback/${encodeURIComponent(studentEmail)}`);
      
      if (response && response.feedback) {
        setAssignments(response.feedback);
        
        // Calculate statistics
        const totalAssignments = response.feedback.length;
        const gradedAssignments = response.feedback.filter(item => 
          item.submission.total_score !== null && item.submission.total_score !== undefined
        ).length;
        
        const gradedItems = response.feedback.filter(item => item.submission.percentage);
        const averageGrade = gradedItems.length > 0 
          ? Math.round(gradedItems.reduce((sum, item) => sum + item.submission.percentage, 0) / gradedItems.length)
          : 0;
        
        const recentGraded = response.feedback
          .filter(item => item.submission.graded_at)
          .sort((a, b) => new Date(b.submission.graded_at) - new Date(a.submission.graded_at))[0];
        
        setStats({
          totalAssignments,
          gradedAssignments,
          averageGrade,
          recentGrade: recentGraded ? recentGraded.submission.percentage : null
        });
      } else {
        setAssignments([]);
      }
      
    } catch (error) {
      console.error('Error loading student data:', error);
      setError('Failed to load your assignments. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('student_data');
    localStorage.removeItem('student_token');
    router.push('/student-login');
  };

  const getScoreColor = (percentage) => {
    if (!percentage) return 'text-gray-600';
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLetterGrade = (percentage) => {
    if (!percentage) return 'N/A';
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
  };

  const getGradeIcon = (percentage) => {
    if (percentage >= 90) return <FaTrophy className="text-yellow-500" />;
    if (percentage >= 80) return <FaAward className="text-blue-500" />;
    if (percentage >= 70) return <FaCheckCircle className="text-green-500" />;
    return <FaExclamationTriangle className="text-orange-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!student) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <FaGraduationCap className="text-white text-2xl mr-3" />
              <div>
                <h1 className="text-xl font-bold text-white">Student Portal</h1>
                <p className="text-blue-100 text-sm">Welcome, {student.name}!</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              <FaSignOutAlt className="mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <FaExclamationTriangle className="text-red-600 dark:text-red-400 mr-3" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FaFileAlt className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assignments</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalAssignments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                <FaCheckCircle className="text-green-600 dark:text-green-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Graded</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.gradedAssignments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FaChartLine className="text-purple-600 dark:text-purple-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Grade</p>
                <p className={`text-2xl font-semibold ${getScoreColor(stats.averageGrade)}`}>
                  {stats.averageGrade > 0 ? `${stats.averageGrade}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900">
                <FaClock className="text-orange-600 dark:text-orange-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Grade</p>
                <p className={`text-2xl font-semibold ${getScoreColor(stats.recentGrade)}`}>
                  {stats.recentGrade ? `${stats.recentGrade}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Student Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {student.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 flex items-center mt-1">
                <FaGraduationCap className="mr-2" />
                {student.email}
              </p>
            </div>
            <div className="text-right">
              {stats.averageGrade > 0 && (
                <div className="flex items-center justify-end">
                  {getGradeIcon(stats.averageGrade)}
                  <div className="ml-2">
                    <div className={`text-3xl font-bold ${getScoreColor(stats.averageGrade)}`}>
                      {getLetterGrade(stats.averageGrade)}
                    </div>
                    <div className="text-sm text-gray-500">Overall Grade</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Assignments */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Your Assignments & Feedback
          </h2>
          
          {assignments.length > 0 ? (
            assignments.map((item, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                {/* Assignment Header */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {item.assignment.title}
                      </h3>
                      <div className="flex items-center text-gray-600 dark:text-gray-400 mt-2 space-x-4">
                        <div className="flex items-center">
                          <FaChalkboardTeacher className="mr-1" />
                          <span>{item.classroom.name}</span>
                        </div>
                        <div className="flex items-center">
                          <FaFileAlt className="mr-1" />
                          <span>{item.assignment.assignment_type}</span>
                        </div>
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-1" />
                          <span>
                            {item.submission.submitted_at 
                              ? `Submitted: ${new Date(item.submission.submitted_at).toLocaleDateString()}`
                              : 'Not submitted'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-6">
                      {item.submission.percentage ? (
                        <div>
                          <div className={`text-4xl font-bold ${getScoreColor(item.submission.percentage)}`}>
                            {item.submission.percentage}%
                          </div>
                          <div className={`text-xl font-semibold ${getScoreColor(item.submission.percentage)}`}>
                            {getLetterGrade(item.submission.percentage)}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {item.feedback.grade}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-400">
                            Not Graded
                          </div>
                          <div className="text-sm text-gray-500">
                            Pending Review
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Feedback Content */}
                <div className="p-6">
                  {/* Teacher Feedback */}
                  {item.feedback.teacher_feedback && (
                    <div className="mb-6">
                      <div className="flex items-center mb-3">
                        <FaComments className="text-blue-500 mr-2" />
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Teacher Feedback
                        </h4>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {item.feedback.teacher_feedback}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* AI Feedback */}
                  {item.feedback.ai_feedback && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Strengths */}
                      {item.feedback.ai_feedback.strengths && item.feedback.ai_feedback.strengths.length > 0 && (
                        <div>
                          <div className="flex items-center mb-3">
                            <FaAward className="text-green-500 mr-2" />
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              What You Did Well
                            </h4>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <ul className="space-y-2">
                              {item.feedback.ai_feedback.strengths.map((strength, idx) => (
                                <li key={idx} className="flex items-start">
                                  <FaCheckCircle className="text-green-600 mt-1 mr-2 flex-shrink-0" />
                                  <span className="text-gray-700 dark:text-gray-300">{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Areas for Improvement */}
                      {item.feedback.ai_feedback.improvements && item.feedback.ai_feedback.improvements.length > 0 && (
                        <div>
                          <div className="flex items-center mb-3">
                            <FaChartLine className="text-orange-500 mr-2" />
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Areas to Improve
                            </h4>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                            <ul className="space-y-2">
                              {item.feedback.ai_feedback.improvements.map((improvement, idx) => (
                                <li key={idx} className="flex items-start">
                                  <FaClock className="text-orange-600 mt-1 mr-2 flex-shrink-0" />
                                  <span className="text-gray-700 dark:text-gray-300">{improvement}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assignment Details */}
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Submitted:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                          {item.submission.submitted_at ? new Date(item.submission.submitted_at).toLocaleDateString() : 'Not submitted'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Graded:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                          {item.submission.graded_at ? new Date(item.submission.graded_at).toLocaleDateString() : 'Not graded'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Max Points:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                          {item.assignment.max_points}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
              <FaGraduationCap className="mx-auto text-gray-400 text-6xl mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Assignments Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You don't have any assignments yet. Check back later or contact your teacher.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentPortal;