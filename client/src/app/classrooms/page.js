"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaPlus, 
  FaUsers, 
  FaFileAlt, 
  FaSync,
  FaGoogle,
  FaEdit,
  FaTrash,
  FaEye
} from "react-icons/fa";
import apiClient from "@/lib/api-client";

const Classrooms = () => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated) {
      loadClassrooms();
    }
  }, [isAuthenticated, loading, router]);

  const loadClassrooms = async () => {
    try {
      setLoadingData(true);
      const data = await apiClient.getClassrooms();
      setClassrooms(data || []);
    } catch (error) {
      console.error('Error loading classrooms:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleGoogleSync = async () => {
    try {
      setSyncing(true);
      console.log('Syncing with Google Classroom...');
      
      const result = await apiClient.post('/api/v1/classrooms/sync/google', {});
      
      if (result.synced_count > 0) {
        alert(`Successfully synced ${result.synced_count} classrooms from Google Classroom!`);
      } else {
        alert('No new classrooms found to sync.');
      }
      
      await loadClassrooms();
    } catch (error) {
      console.error('Error syncing with Google Classroom:', error);
      if (error.message.includes('Google authentication required')) {
        alert('Please authenticate with Google first by logging in through Google OAuth.');
      } else {
        alert('Failed to sync with Google Classroom. Please try again.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteClassroom = async (classroomId) => {
    if (window.confirm('Are you sure you want to delete this classroom? This action cannot be undone.')) {
      try {
        // await apiClient.deleteClassroom(classroomId);
        console.log('Deleting classroom:', classroomId);
        await loadClassrooms();
      } catch (error) {
        console.error('Error deleting classroom:', error);
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
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Your Classrooms
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Manage your classrooms and sync with Google Classroom
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleGoogleSync}
                disabled={syncing}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <FaGoogle className={`mr-2 text-red-500 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Google Classroom'}
              </button>
              <Link
                href="/classrooms/create"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="mr-2" />
                Create Classroom
              </Link>
            </div>
          </div>
        </div>

        {/* Classrooms Grid */}
        {classrooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classrooms.map((classroom) => (
              <div key={classroom.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                {/* Classroom Header */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
                  <h3 className="text-lg font-semibold">{classroom.name}</h3>
                  <p className="text-blue-100 text-sm">
                    {classroom.subject} {classroom.section && `• ${classroom.section}`}
                  </p>
                </div>

                {/* Classroom Content */}
                <div className="p-6">
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <FaUsers className="mr-2" />
                      <span>{classroom.student_count || 0} students</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <FaFileAlt className="mr-2" />
                      <span>{classroom.assignment_count || 0} assignments</span>
                    </div>
                    {classroom.google_classroom_id && (
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                        <FaGoogle className="mr-2" />
                        <span>Synced with Google Classroom</span>
                      </div>
                    )}
                    {classroom.room && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Room:</strong> {classroom.room}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <Link
                      href={`/classrooms/${classroom.id}`}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      <FaEye className="mr-1" />
                      View
                    </Link>
                    <Link
                      href={`/classrooms/${classroom.id}/edit`}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      <FaEdit />
                    </Link>
                    <button
                      onClick={() => handleDeleteClassroom(classroom.id)}
                      className="inline-flex items-center px-3 py-2 border border-red-300 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 text-sm rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                {/* Last Sync Info */}
                {classroom.last_sync_at && (
                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last synced: {new Date(classroom.last_sync_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          // Empty State
          <div className="text-center py-12">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 max-w-md mx-auto">
              <FaUsers className="mx-auto text-gray-400 text-6xl mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                No classrooms yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Get started by creating your first classroom or syncing with Google Classroom
              </p>
              <div className="space-y-3">
                <Link
                  href="/classrooms/create"
                  className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaPlus className="inline mr-2" />
                  Create New Classroom
                </Link>
                <button
                  onClick={handleGoogleSync}
                  disabled={syncing}
                  className="block w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <FaGoogle className={`inline mr-2 text-red-500 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Google Classroom'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            💡 Getting Started with Classrooms
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Manual Creation</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Create classrooms manually by clicking "Create Classroom" and filling in the details.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Google Classroom Sync</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Automatically import your existing Google Classroom classes with students and assignments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Classrooms;