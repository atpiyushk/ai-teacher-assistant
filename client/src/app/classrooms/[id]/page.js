"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaArrowLeft,
  FaUsers,
  FaFileAlt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaGoogle,
  FaSync,
  FaClock
} from "react-icons/fa";
import apiClient from "@/lib/api-client";

const ClassroomDetail = ({ params }) => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('assignments');
  const [classroomId, setClassroomId] = useState(null);

  // Handle Next.js 15 params properly
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setClassroomId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated && classroomId) {
      loadClassroomData();
    }
  }, [isAuthenticated, loading, router, classroomId]);

  const loadClassroomData = async () => {
    try {
      setLoadingData(true);
      
      // Load classroom details
      const classroomData = await apiClient.get(`/api/v1/classrooms/${classroomId}`);
      setClassroom(classroomData);
      
      // Load assignments for this classroom
      const assignmentsData = await apiClient.get(`/api/v1/assignments?classroom_id=${classroomId}`);
      setAssignments(assignmentsData || []);
      
      // Load students (from enrollments)
      try {
        const studentsData = await apiClient.get(`/api/v1/classrooms/${classroomId}/students`);
        setStudents(studentsData || []);
      } catch (error) {
        console.error('Error loading students:', error);
        // If endpoint doesn't exist, fall back to empty array
        setStudents([]);
      }
      
    } catch (error) {
      console.error('Error loading classroom data:', error);
      if (error.message.includes('404')) {
        router.push('/classrooms');
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (window.confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
      try {
        await apiClient.delete(`/api/v1/assignments/${assignmentId}`);
        await loadClassroomData(); // Refresh data
      } catch (error) {
        console.error('Error deleting assignment:', error);
        alert('Failed to delete assignment. Please try again.');
      }
    }
  };

  const handleSync = async () => {
    try {
      console.log('Syncing classroom with Google Classroom...');
      
      const result = await apiClient.post(`/api/v1/classrooms/${classroomId}/sync`, {});
      
      // Show success message
      alert(`Successfully synced classroom! ${result.assignments_synced} assignments and ${result.students_synced} students synced.`);
      
      // Refresh data
      await loadClassroomData();
    } catch (error) {
      console.error('Error syncing classroom:', error);
      if (error.message.includes('Google authentication required') || error.message.includes('Insufficient permissions')) {
        const shouldReauth = confirm('Your Google authentication needs to be updated to access Drive files. Would you like to re-authenticate now?');
        if (shouldReauth) {
          // Redirect to re-authentication endpoint
          window.location.href = 'http://localhost:8000/api/v1/auth/reauth/google';
        }
      } else {
        alert(`Failed to sync classroom: ${error.message}`);
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

  if (!isAuthenticated || !classroom) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/classrooms"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to Classrooms
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {classroom.name}
              </h1>
              <div className="flex items-center space-x-4 mt-2">
                <p className="text-gray-600 dark:text-gray-400">
                  {classroom.subject} {classroom.section && `• ${classroom.section}`}
                </p>
                {classroom.google_classroom_id && (
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <FaGoogle className="mr-1" />
                    <span className="text-sm">Synced with Google</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              {classroom.google_classroom_id && (
                <button
                  onClick={handleSync}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FaSync className="mr-2" />
                  Sync
                </button>
              )}
              <button
                onClick={() => {
                  window.location.href = 'http://localhost:8000/api/v1/auth/reauth/google';
                }}
                className="inline-flex items-center px-4 py-2 border border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
              >
                <FaGoogle className="mr-2" />
                Re-authenticate Google
              </button>
              <Link
                href={`/classrooms/${classroomId}/edit`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <FaEdit className="mr-2" />
                Edit Classroom
              </Link>
              <Link
                href={`/assignments/create?classroom_id=${classroomId}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="mr-2" />
                New Assignment
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FaUsers className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Students</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {classroom.student_count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                <FaFileAlt className="text-green-600 dark:text-green-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Assignments</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {classroom.assignment_count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FaClock className="text-purple-600 dark:text-purple-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Sync</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {classroom.last_sync_at ? new Date(classroom.last_sync_at).toLocaleDateString() : 'Never'}
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
                onClick={() => setActiveTab('assignments')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'assignments'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Assignments ({assignments.length})
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'students'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Students ({students.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'assignments' && (
              <div>
                {assignments.length > 0 ? (
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                              {assignment.title}
                            </h3>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                              <span>Type: {assignment.assignment_type}</span>
                              <span>Max Points: {assignment.max_points}</span>
                              {assignment.due_date && (
                                <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                              )}
                              <span>Submissions: {assignment.submission_count || 0}</span>
                              <span>Graded: {assignment.graded_count || 0}</span>
                            </div>
                            {assignment.description && (
                              <p className="mt-2 text-gray-600 dark:text-gray-400">
                                {assignment.description}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex space-x-2 ml-4">
                            <Link
                              href={`/assignments/${assignment.id}`}
                              className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                            >
                              <FaEye className="mr-1" />
                              View
                            </Link>
                            <Link
                              href={`/assignments/${assignment.id}/edit`}
                              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                              <FaEdit />
                            </Link>
                            <button
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="inline-flex items-center px-3 py-2 border border-red-300 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 text-sm rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FaFileAlt className="mx-auto text-gray-400 text-4xl mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No assignments yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Create your first assignment to get started
                    </p>
                    <Link
                      href={`/assignments/create?classroom_id=${classroomId}`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <FaPlus className="mr-2" />
                      Create Assignment
                    </Link>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'students' && (
              <div>
                {students.length > 0 ? (
                  <div className="space-y-4">
                    {students.map((student, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{student.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{student.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Avg Grade: {student.avgGrade || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Assignments: {student.assignmentCount || 0}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FaUsers className="mx-auto text-gray-400 text-4xl mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      No students enrolled
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Students will appear here when they join your classroom
                    </p>
                    {classroom.google_classroom_id ? (
                      <button
                        onClick={handleSync}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <FaSync className="mr-2" />
                        Sync Students from Google
                      </button>
                    ) : (
                      <p className="text-xs text-gray-400">
                        Sync with Google Classroom to automatically import students
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Classroom Info */}
        {classroom.room && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Classroom Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Room:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">{classroom.room}</span>
              </div>
              {classroom.google_classroom_id && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Google Classroom ID:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{classroom.google_classroom_id}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Created:</span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {new Date(classroom.created_at).toLocaleDateString()}
                </span>
              </div>
              {classroom.last_sync_at && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Last Synced:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">
                    {new Date(classroom.last_sync_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassroomDetail;