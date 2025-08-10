"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaArrowLeft,
  FaEdit,
  FaUsers,
  FaClock,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaEye,
  FaDownload,
  FaRobot
} from "react-icons/fa";
import apiClient from "@/lib/api-client";

const AssignmentDetail = ({ params }) => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [assignmentId, setAssignmentId] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Handle Next.js 15 params properly
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setAssignmentId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated && assignmentId) {
      loadAssignmentData();
    }
  }, [isAuthenticated, loading, router, assignmentId]);

  const loadAssignmentData = async () => {
    try {
      setLoadingData(true);
      
      // Load assignment details
      const assignmentData = await apiClient.get(`/api/v1/assignments/${assignmentId}`);
      setAssignment(assignmentData);
      
      // Load classroom details
      if (assignmentData.classroom_id) {
        const classroomData = await apiClient.get(`/api/v1/classrooms/${assignmentData.classroom_id}`);
        setClassroom(classroomData);
      }
      
      // Load submissions
      try {
        const submissionsData = await apiClient.get(`/api/v1/submissions?assignment_id=${assignmentId}`);
        setSubmissions(submissionsData || []);
      } catch (error) {
        console.error('Error loading submissions:', error);
        setSubmissions([]);
      }
      
    } catch (error) {
      console.error('Error loading assignment data:', error);
      if (error.message.includes('404')) {
        router.push('/dashboard');
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleGradeAll = async () => {
    try {
      console.log('Auto-grading all submissions...');
      
      // Confirm with user
      const ungraded = submissions.filter(s => s.status !== 'graded').length;
      if (ungraded === 0) {
        alert('All submissions are already graded!');
        return;
      }
      
      const confirm = window.confirm(`This will automatically grade ${ungraded} ungraded submissions. Continue?`);
      if (!confirm) return;
      
      // Show loading state
      const button = document.querySelector('[data-grading="true"]');
      if (button) {
        button.disabled = true;
        button.textContent = 'Grading...';
      }
      
      // Trigger AI grading for all ungraded submissions
      const result = await apiClient.post(`/api/v1/grading/assignments/${assignmentId}/batch`, {
        model: 'gemini'
      });
      
      console.log('Batch grading result:', result);
      
      // Show results
      const { graded_count, failed_count, total_submissions } = result;
      
      if (graded_count > 0) {
        alert(`Successfully graded ${graded_count} submissions!\n${failed_count > 0 ? `${failed_count} submissions failed to grade.` : ''}`);
      } else if (failed_count > 0) {
        alert(`Grading failed for ${failed_count} submissions. Please check the logs and try manual grading.`);
      } else {
        alert('No submissions were processed. Make sure submissions have content to grade.');
      }
      
      // Reload data to show updated grades
      await loadAssignmentData();
      
    } catch (error) {
      console.error('Error auto-grading:', error);
      alert(`Auto-grading failed: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      // Reset button state
      const button = document.querySelector('[data-grading="true"]');
      if (button) {
        button.disabled = false;
        button.textContent = 'Auto-Grade All';
      }
    }
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#1D2F6F]"></div>
      </div>
    );
  }

  if (!isAuthenticated || !assignment) {
    return null;
  }

  const gradedCount = submissions.filter(s => s.status === 'graded').length;
  const pendingCount = submissions.length - gradedCount;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href={classroom ? `/classrooms/${classroom.id}` : '/dashboard'}
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to {classroom ? classroom.name : 'Dashboard'}
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {assignment.title}
              </h1>
              <div className="flex items-center space-x-4 mt-2">
                <p className="text-gray-600 dark:text-gray-400">
                  {assignment.assignment_type} • {assignment.max_points} points
                </p>
                {assignment.due_date && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                    <FaClock className="mr-1" />
                    <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleGradeAll}
                data-grading="true"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <FaRobot className="mr-2" />
                Auto-Grade All
              </button>
              <Link
                href={`/assignments/${assignmentId}/edit`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <FaEdit className="mr-2" />
                Edit Assignment
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FaUsers className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Submissions</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {assignment.submission_count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                <FaCheckCircle className="text-green-600 dark:text-green-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Graded</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {assignment.graded_count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900">
                <FaExclamationCircle className="text-orange-600 dark:text-orange-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {(assignment.submission_count || 0) - (assignment.graded_count || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FaFileAlt className="text-purple-600 dark:text-purple-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {assignment.average_score ? `${assignment.average_score}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('submissions')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'submissions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Submissions ({submissions.length})
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'questions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Questions
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {assignment.description && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Description
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {assignment.description}
                    </p>
                  </div>
                )}

                {assignment.instructions && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Instructions
                    </h3>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {assignment.instructions}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Assignment Settings
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Auto-Grading</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          assignment.auto_grade 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                        }`}>
                          {assignment.auto_grade ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-700 dark:text-gray-300">Assignment Type</span>
                        <span className="text-gray-900 dark:text-white font-medium capitalize">
                          {assignment.assignment_type}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'submissions' && (
              <div>
                {submissions.length > 0 ? (
                  <div className="space-y-4">
                    {submissions.map((submission) => (
                      <div key={submission.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                              {submission.student_name || `Student ${submission.student_id}`}
                            </h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {submission.student_email}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                              {submission.submitted_at && (
                                <span>Submitted: {new Date(submission.submitted_at).toLocaleDateString()}</span>
                              )}
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                submission.status === 'graded'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : submission.status === 'returned'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}>
                                {submission.status}
                              </span>
                              {submission.total_score !== undefined && submission.total_score !== null && (
                                <span className="font-medium">
                                  Grade: {submission.total_score}/{assignment.max_points}
                                </span>
                              )}
                              {submission.google_submission_id && (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                  Google Classroom
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex space-x-2 ml-4">
                            <Link
                              href={`/submissions/${submission.id}`}
                              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              <FaEye className="mr-1" />
                              Review
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FaFileAlt className="mx-auto text-gray-400 text-4xl mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No submissions yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Submissions will appear here when students submit their work
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'questions' && (
              <div>
                {assignment.grading_criteria?.questions?.length > 0 ? (
                  <div className="space-y-6">
                    {assignment.grading_criteria.questions.map((question, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            Question {index + 1}
                          </h4>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {question.points} points
                          </span>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Question Text
                            </h5>
                            <p className="text-gray-900 dark:text-white">
                              {question.question_text}
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Question Type
                              </h5>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                                {question.question_type?.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                          
                          {question.grading_criteria && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Grading Criteria
                              </h5>
                              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                <p className="text-gray-700 dark:text-gray-300 text-sm">
                                  {question.grading_criteria}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FaFileAlt className="mx-auto text-gray-400 text-4xl mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No questions defined
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Questions will be displayed here if they were defined during assignment creation
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentDetail;