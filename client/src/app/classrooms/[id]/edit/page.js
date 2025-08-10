"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaSave, FaGoogle } from "react-icons/fa";
import apiClient from "@/lib/api-client";

const EditClassroom = ({ params }) => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [classroom, setClassroom] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    section: "",
    room: "",
    sync_enabled: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
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
      const classroomData = await apiClient.get(`/api/v1/classrooms/${classroomId}`);
      setClassroom(classroomData);
      setFormData({
        name: classroomData.name || "",
        subject: classroomData.subject || "",
        section: classroomData.section || "",
        room: classroomData.room || "",
        sync_enabled: classroomData.sync_enabled !== false
      });
    } catch (error) {
      console.error('Error loading classroom:', error);
      if (error.message.includes('404')) {
        router.push('/classrooms');
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.put(`/api/v1/classrooms/${classroomId}`, formData);
      router.push(`/classrooms/${classroomId}`);
    } catch (error) {
      console.error('Error updating classroom:', error);
      alert('Failed to update classroom. Please try again.');
    } finally {
      setIsLoading(false);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href={`/classrooms/${classroomId}`}
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to Classroom
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit Classroom
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Update classroom information and settings
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Classroom Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Classroom Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter classroom name"
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject
              </label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Mathematics, Science, English"
              />
            </div>

            {/* Section and Room */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Section
                </label>
                <input
                  type="text"
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., A, B, Period 1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Room
                </label>
                <input
                  type="text"
                  name="room"
                  value={formData.room}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Room 101"
                />
              </div>
            </div>

            {/* Google Classroom Integration */}
            {classroom.google_classroom_id && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FaGoogle className="text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-100">
                      Google Classroom Integration
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      This classroom is synced with Google Classroom (ID: {classroom.google_classroom_id})
                    </p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      name="sync_enabled"
                      checked={formData.sync_enabled}
                      onChange={handleChange}
                      className="mr-2"
                    />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Enable automatic sync with Google Classroom
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Link
                href={`/classrooms/${classroomId}`}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FaSave className="mr-2" />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditClassroom;