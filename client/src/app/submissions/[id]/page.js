"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaArrowLeft,
  FaUser,
  FaCalendarAlt,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationCircle,
  FaClock,
  FaEdit,
  FaSave,
  FaRobot,
  FaEye,
  FaClipboard,
  FaGraduationCap,
  FaUpload,
  FaTimes,
  FaChartLine
} from "react-icons/fa";
import apiClient from "@/lib/api-client";

const SubmissionReview = ({ params }) => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [submission, setSubmission] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [student, setStudent] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [submissionId, setSubmissionId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    feedback: "",
    total_score: ""
  });
  const [saving, setSaving] = useState(false);
  const [grading, setGrading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Handle Next.js 15 params properly
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setSubmissionId(resolvedParams.id);
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    
    if (isAuthenticated && submissionId) {
      loadSubmissionData();
    }
  }, [isAuthenticated, loading, router, submissionId]);

  const loadSubmissionData = async () => {
    try {
      setLoadingData(true);
      
      // Load submission details with files
      const submissionData = await apiClient.get(`/api/v1/submissions/${submissionId}`);
      setSubmission(submissionData);
      
      // Load assignment details
      if (submissionData.assignment_id) {
        const assignmentData = await apiClient.get(`/api/v1/assignments/${submissionData.assignment_id}`);
        setAssignment(assignmentData);
      }
      
      // Set student details from submission data
      if (submissionData.student_name) {
        setStudent({
          name: submissionData.student_name,
          email: submissionData.student_email,
          google_id: submissionData.student_google_id
        });
      }
      
      // Set edit data
      setEditData({
        feedback: submissionData.feedback || "",
        total_score: submissionData.total_score || ""
      });
      
    } catch (error) {
      console.error('Error loading submission data:', error);
      if (error.message.includes('404')) {
        router.push('/dashboard');
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData = {
        feedback: editData.feedback.trim() || null,
        total_score: editData.total_score ? parseFloat(editData.total_score) : null
      };
      
      await apiClient.patch(`/api/v1/submissions/${submissionId}`, updateData);
      await loadSubmissionData();
      setIsEditing(false);
      
    } catch (error) {
      console.error('Error saving submission:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGrade = async () => {
    try {
      setGrading(true);
      
      // Check if submission has any content to grade
      const hasFiles = submission.files && submission.files.length > 0;
      const hasExtractedText = submission.student_answers?.extracted_text;
      const hasAnswer = submission.student_answers?.answer;
      const hasText = submission.student_answers?.text;
      
      if (!hasFiles && !hasExtractedText && !hasAnswer && !hasText) {
        alert('This submission has no content to grade. Please upload files or ask the student to submit their work.');
        setGrading(false);
        return;
      }
      
      // Call AI grading endpoint
      const response = await apiClient.post(`/api/v1/grading/submissions/${submissionId}`, {
        model: 'gemini-pro' // Using available model from MCP server
      });
      
      console.log('AI Grading response:', response);
      
      // Reload submission data to show new grade
      await loadSubmissionData();
      setGrading(false);
      
      alert(`AI grading completed! Score: ${response.score}/${assignment?.max_points || '?'}`);
      
    } catch (error) {
      console.error('Error auto-grading submission:', error);
      
      // Show user-friendly error message
      if (error.message.includes('No content to grade')) {
        alert('This submission has no content to grade. Please upload files or ask the student to resubmit their work.');
      } else if (error.message.includes('already graded')) {
        alert('This submission has already been graded. Use manual grading to update the score.');
      } else {
        alert(`AI grading failed: ${error.message || 'Please try again or grade manually.'}`);
      }
      
      setGrading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      await apiClient.uploadFile(`/api/v1/submissions/${submissionId}/files`, formData);
      
      // Reload submission data to show new file
      await loadSubmissionData();
      setSelectedFile(null);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };


  const getStatusColor = (status) => {
    switch (status) {
      case 'graded':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'returned':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200';
    }
  };

  const getScoreColor = (score, maxPoints) => {
    if (!score || !maxPoints) return 'text-gray-600 dark:text-gray-400';
    const percentage = (score / maxPoints) * 100;
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 80) return 'text-blue-600 dark:text-blue-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#1D2F6F]"></div>
      </div>
    );
  }

  if (!isAuthenticated || !submission) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href={assignment ? `/assignments/${assignment.id}` : '/dashboard'}
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to {assignment ? `Assignment: ${assignment.title}` : 'Dashboard'}
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Submission Review
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Review and grade student submission
              </p>
            </div>
            
            <div className="flex space-x-3">
              {/* AI Grade Button - always show, let backend handle validation */}
              {submission.status !== 'graded' && (
                <button
                  onClick={handleAutoGrade}
                  disabled={grading}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {grading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <FaRobot className="mr-2" />
                  )}
                  {grading ? 'AI Grading...' : 'AI Grade'}
                </button>
              )}
              
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FaEdit className="mr-2" />
                  Manual Grade
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <FaSave className="mr-2" />
                    )}
                    {saving ? 'Saving...' : 'Save Grade'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Student & Assignment Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Submission Details
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center mb-4">
                    <FaUser className="text-blue-500 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Student</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {student?.name || 'Unknown Student'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {student?.email}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center mb-4">
                    <FaGraduationCap className="text-purple-500 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Assignment</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {assignment?.title || 'Unknown Assignment'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {assignment?.assignment_type} • {assignment?.max_points} points
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center mb-4">
                    <FaCalendarAlt className="text-green-500 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Submitted</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {submission.submitted_at 
                          ? new Date(submission.submitted_at).toLocaleDateString()
                          : 'Not submitted yet'
                        }
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">
                        {submission.submitted_at 
                          ? new Date(submission.submitted_at).toLocaleTimeString()
                          : ''
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center mb-4">
                    <FaClock className="text-orange-500 mr-3" />
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Status</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                      {submission.google_submission_id && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Google Classroom
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Student Answers */}
            {submission.student_answers && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Student's Response
                </h2>
                
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  {submission.student_answers.type === 'short_answer' && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Short Answer Response:</p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {submission.student_answers.answer || 'No answer provided'}
                      </p>
                    </div>
                  )}
                  
                  {submission.student_answers.type === 'multiple_choice' && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Multiple Choice Selection:</p>
                      <p className="text-gray-900 dark:text-white font-medium">
                        {submission.student_answers.answer || 'No selection made'}
                      </p>
                    </div>
                  )}
                  
                  {submission.student_answers.type === 'assignment' && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Assignment Response:</p>
                      <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                        {submission.student_answers.text || submission.student_answers.answer || 'See attached files'}
                      </p>
                      
                      {/* Show extracted content from Drive files */}
                      {submission.student_answers.extracted_text && (
                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                            Extracted Content from Drive Files:
                          </h4>
                          <div className="text-blue-800 dark:text-blue-200 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
                            {submission.student_answers.extracted_text}
                          </div>
                        </div>
                      )}
                      
                      {submission.student_answers.attachments && submission.student_answers.attachments.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Attachments:</p>
                          <ul className="mt-1 space-y-1">
                            {submission.student_answers.attachments.map((att, idx) => (
                              <li key={idx} className="text-sm text-gray-700 dark:text-gray-300">
                                {att.link && `• Link: ${att.link.url}`}
                                {att.driveFile && `• Drive File: ${att.driveFile.title}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Files */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Uploaded Files ({submission.files ? submission.files.length : 0})
                </h2>
                <button
                  onClick={() => document.getElementById('file-input').click()}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaUpload className="mr-2" />
                  Upload File
                </button>
              </div>
              
              {/* File Upload Input */}
              <input
                id="file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="hidden"
              />
              
              {/* Selected File Preview */}
              {selectedFile && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FaFileAlt className="text-blue-500" />
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">{selectedFile.name}</p>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          {Math.round(selectedFile.size / 1024)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleFileUpload}
                        disabled={uploading}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {uploading ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                        ) : (
                          <FaUpload className="mr-1" />
                        )}
                        {uploading ? 'Uploading...' : 'Upload'}
                      </button>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Uploaded Files List */}
              {submission.files && submission.files.length > 0 ? (
                <div className="space-y-3">
                  {submission.files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FaFileAlt className="text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{file.filename}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {file.file_type} • {Math.round(file.file_size / 1024)} KB
                          </p>
                          <p className="text-xs text-gray-400">
                            OCR: <span className={`font-medium ${
                              file.ocr_status === 'completed' ? 'text-green-600' : 
                              file.ocr_status === 'processing' ? 'text-yellow-600' : 
                              'text-gray-600'
                            }`}>
                              {file.ocr_status}
                            </span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400">
                          <FaEye />
                        </button>
                        <button className="p-2 text-gray-600 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400">
                          <FaDownload />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FaFileAlt className="mx-auto text-gray-400 text-4xl mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No files uploaded
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Upload files to enable AI auto-grading
                  </p>
                </div>
              )}
            </div>

            {/* AI Feedback */}
            {submission.ai_feedback && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  AI Analysis & Feedback
                </h2>
                
                <div className="space-y-6">
                  {/* Model Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FaRobot className="text-blue-500 mr-2" />
                      <span className="font-medium text-gray-900 dark:text-white">AI Assessment</span>
                    </div>
                    {submission.ai_feedback.model && (
                      <span className="text-xs text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">
                        {submission.ai_feedback.model}
                      </span>
                    )}
                  </div>

                  {/* Strengths */}
                  {submission.ai_feedback.strengths && submission.ai_feedback.strengths.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <h4 className="font-medium text-green-800 dark:text-green-200 mb-3 flex items-center">
                        <FaCheckCircle className="mr-2" />
                        Strengths & What You Did Well
                      </h4>
                      <ul className="space-y-2">
                        {submission.ai_feedback.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start">
                            <div className="w-2 h-2 bg-green-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            <span className="text-green-800 dark:text-green-200">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Areas for Improvement */}
                  {submission.ai_feedback.improvements && submission.ai_feedback.improvements.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                      <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-3 flex items-center">
                        <FaExclamationCircle className="mr-2" />
                        Areas for Improvement
                      </h4>
                      <ul className="space-y-2">
                        {submission.ai_feedback.improvements.map((improvement, idx) => (
                          <li key={idx} className="flex items-start">
                            <div className="w-2 h-2 bg-orange-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            <span className="text-orange-800 dark:text-orange-200">{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Detailed Scores */}
                  {submission.ai_feedback.detailed_scores && Object.keys(submission.ai_feedback.detailed_scores).length > 0 && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                      <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-3 flex items-center">
                        <FaChartLine className="mr-2" />
                        Detailed Scoring Breakdown
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(submission.ai_feedback.detailed_scores).map(([criterion, score]) => (
                          <div key={criterion} className="bg-white dark:bg-gray-700 rounded p-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{criterion}</span>
                              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw AI Response (fallback) */}
                  {(!submission.ai_feedback.strengths && !submission.ai_feedback.improvements && !submission.ai_feedback.detailed_scores) && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">AI Feedback</h4>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {typeof submission.ai_feedback === 'object' && submission.ai_feedback.raw_response ? (
                          <p className="whitespace-pre-wrap">{submission.ai_feedback.raw_response}</p>
                        ) : typeof submission.ai_feedback === 'string' ? (
                          <p>{submission.ai_feedback}</p>
                        ) : (
                          <pre className="whitespace-pre-wrap text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded">
                            {JSON.stringify(submission.ai_feedback, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Score Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Grade
              </h3>
              
              {!isEditing ? (
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-2 ${getScoreColor(submission.total_score, assignment?.max_points)}`}>
                    {submission.total_score !== null && submission.total_score !== undefined 
                      ? `${submission.total_score}/${assignment?.max_points || '?'}`
                      : 'Not Graded'
                    }
                  </div>
                  {submission.total_score !== null && assignment?.max_points && (
                    <div className={`text-lg ${getScoreColor(submission.total_score, assignment.max_points)}`}>
                      {Math.round((submission.total_score / assignment.max_points) * 100)}%
                    </div>
                  )}
                  {submission.graded_at && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Graded: {new Date(submission.graded_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Score (out of {assignment?.max_points || '?'})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={assignment?.max_points || 100}
                    step="0.5"
                    value={editData.total_score}
                    onChange={(e) => setEditData(prev => ({ ...prev, total_score: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter score"
                  />
                </div>
              )}
            </div>

            {/* Feedback */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Feedback
              </h3>
              
              {!isEditing ? (
                <div>
                  {submission.feedback ? (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {submission.feedback}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic">
                      No feedback provided yet
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Feedback for Student
                  </label>
                  <textarea
                    rows={6}
                    value={editData.feedback}
                    onChange={(e) => setEditData(prev => ({ ...prev, feedback: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Provide feedback to help the student improve..."
                  />
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(submission.id);
                  }}
                  className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <FaClipboard className="mr-2" />
                  Copy Submission ID
                </button>
                
                {assignment && (
                  <Link
                    href={`/assignments/${assignment.id}`}
                    className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <FaFileAlt className="mr-2" />
                    View Assignment
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionReview;