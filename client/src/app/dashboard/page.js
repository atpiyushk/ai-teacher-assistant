"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaPlus, 
  FaChalkboardTeacher, 
  FaFileAlt, 
  FaUsers, 
  FaGraduationCap,
  FaChartLine,
  FaCog,
  FaGoogle
} from "react-icons/fa";
import apiClient from "@/lib/api-client";

const Dashboard = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    classrooms: 0,
    students: 0,
    assignments: 0,
    pendingGrading: 0
  });
  const [classrooms, setClassrooms] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, loading, router]);

  const loadDashboardData = async () => {
    try {
      setLoadingData(true);
      
      // Load classrooms, assignments, and submissions
      const [classroomsData, assignmentsData, submissionsData] = await Promise.all([
        apiClient.getClassrooms(),
        apiClient.get('/api/v1/assignments').catch(() => []),
        apiClient.get('/api/v1/submissions').catch(() => [])
      ]);
      
      setClassrooms(classroomsData || []);
      
      // Calculate real stats
      const classroomCount = classroomsData?.length || 0;
      const studentCount = classroomsData?.reduce((sum, classroom) => sum + (classroom.student_count || 0), 0) || 0;
      const assignmentCount = assignmentsData?.length || 0;
      const pendingCount = submissionsData?.filter(s => s.status !== 'graded').length || 0;
      
      setStats({
        classrooms: classroomCount,
        students: studentCount,
        assignments: assignmentCount,
        pendingGrading: pendingCount
      });
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleGoogleClassroomSync = async () => {
    try {
      // Check if user is authenticated with Google
      if (!user?.google_id) {
        // Redirect to Google OAuth for classroom access
        console.log('Redirecting to Google OAuth for classroom access...');
        await apiClient.loginWithGoogle();
        return;
      }

      console.log('Starting Google Classroom sync...');
      const result = await apiClient.post('/api/v1/classrooms/sync/google', {});
      
      if (result.synced_count > 0) {
        alert(`Successfully synced ${result.synced_count} classrooms from Google Classroom!`);
        // Refresh data after sync
        await loadDashboardData();
      } else {
        alert('No new classrooms found to sync.');
      }
    } catch (error) {
      console.error('Error syncing with Google Classroom:', error);
      if (error.message.includes('Google authentication required') || error.message.includes('Insufficient permissions')) {
        const shouldReauth = confirm('Your Google authentication needs to be updated to access Drive files. Would you like to re-authenticate now?');
        if (shouldReauth) {
          // Redirect to re-authentication endpoint
          window.location.href = 'http://localhost:8000/api/v1/auth/reauth/google';
        }
      } else {
        alert('Failed to sync with Google Classroom. Please try again.');
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

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name || 'Teacher'}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your classrooms, assignments, and AI-powered grading
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FaChalkboardTeacher className="text-blue-600 dark:text-blue-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Classrooms</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.classrooms}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                <FaUsers className="text-green-600 dark:text-green-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Students</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.students}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                <FaFileAlt className="text-purple-600 dark:text-purple-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Assignments</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.assignments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900">
                <FaGraduationCap className="text-orange-600 dark:text-orange-400 text-xl" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Grading</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.pendingGrading}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/classrooms/create" className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaPlus className="text-blue-600 dark:text-blue-400 mr-3" />
              <span className="text-gray-900 dark:text-white font-medium">Create Classroom</span>
            </Link>
            
            <Link href="/assignments/create" className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaFileAlt className="text-green-600 dark:text-green-400 mr-3" />
              <span className="text-gray-900 dark:text-white font-medium">New Assignment</span>
            </Link>
            
            <button 
              onClick={handleGoogleClassroomSync}
              className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <FaGoogle className="text-red-600 dark:text-red-400 mr-3" />
              <span className="text-gray-900 dark:text-white font-medium">Sync Google Classroom</span>
            </button>
            
            <button 
              onClick={() => {
                window.location.href = 'http://localhost:8000/api/v1/auth/reauth/google';
              }}
              className="flex items-center p-4 border border-orange-200 dark:border-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            >
              <FaGoogle className="text-orange-600 dark:text-orange-400 mr-3" />
              <span className="text-gray-900 dark:text-white font-medium">Re-authenticate Google</span>
            </button>
            
            <Link href="/analytics" className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <FaChartLine className="text-purple-600 dark:text-purple-400 mr-3" />
              <span className="text-gray-900 dark:text-white font-medium">View Analytics</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Classrooms */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Classrooms</h2>
                <Link href="/classrooms" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                  View all
                </Link>
              </div>
            </div>
            <div className="p-6">
              {classrooms.length > 0 ? (
                <div className="space-y-4">
                  {classrooms.slice(0, 5).map((classroom) => (
                    <div key={classroom.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{classroom.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {classroom.subject} • {classroom.section}
                        </p>
                      </div>
                      <Link 
                        href={`/classrooms/${classroom.id}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        Manage
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FaChalkboardTeacher className="mx-auto text-gray-400 text-4xl mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No classrooms yet</p>
                  <Link 
                    href="/classrooms/create"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FaPlus className="mr-2" />
                    Create your first classroom
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
            </div>
            <div className="p-6">
              {recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-start">
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
                      <div>
                        <p className="text-sm text-gray-900 dark:text-white">{activity.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FaChartLine className="mx-auto text-gray-400 text-4xl mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Create classrooms and assignments to see activity here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Getting Started Guide */}
        {stats.classrooms === 0 && (
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🚀 Getting Started with AISensei
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">1</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Create Classrooms</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Set up your classrooms and sync with Google Classroom
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-400 font-bold text-lg">2</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Add Assignments</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Create assignments with AI-powered grading criteria
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg mx-auto mb-3 flex items-center justify-center">
                  <span className="text-purple-600 dark:text-purple-400 font-bold text-lg">3</span>
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Grade with AI</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Let AI help you grade and provide personalized feedback
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;