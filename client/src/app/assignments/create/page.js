"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaArrowLeft, 
  FaSave, 
  FaPlus, 
  FaTrash,
  FaFileAlt,
  FaClock,
  FaRobot,
  FaTable
} from "react-icons/fa";
import apiClient from "@/lib/api-client";
import RubricBuilder from "@/components/RubricBuilder";

const CreateAssignment = () => {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    instructions: "",
    classroom_id: "",
    assignment_type: "homework",
    max_points: 100,
    due_date: "",
    auto_grade: false
  });
  const [questions, setQuestions] = useState([{
    question_text: "",
    question_type: "short_answer",
    points: 10,
    correct_answer: "",
    grading_criteria: ""
  }]);
  const [rubric, setRubric] = useState(null);
  const [activeSection, setActiveSection] = useState('basic');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

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
      const data = await apiClient.getClassrooms();
      setClassrooms(data || []);
    } catch (error) {
      console.error('Error loading classrooms:', error);
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
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index][field] = value;
    setQuestions(updatedQuestions);
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: "",
      question_type: "short_answer",
      points: 10,
      correct_answer: "",
      grading_criteria: ""
    }]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      const updatedQuestions = questions.filter((_, i) => i !== index);
      setQuestions(updatedQuestions);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = "Assignment title is required";
    }
    
    if (!formData.classroom_id) {
      newErrors.classroom_id = "Please select a classroom";
    }
    
    if (formData.max_points <= 0) {
      newErrors.max_points = "Max points must be greater than 0";
    }
    
    // Validate questions
    questions.forEach((question, index) => {
      if (!question.question_text.trim()) {
        newErrors[`question_${index}`] = "Question text is required";
      }
    });
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const assignmentData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        instructions: formData.instructions.trim() || null,
        classroom_id: formData.classroom_id,
        assignment_type: formData.assignment_type,
        max_points: parseFloat(formData.max_points),
        due_date: formData.due_date || null,
        auto_grade: formData.auto_grade,
        grading_criteria: {
          questions: questions.map((q, index) => ({
            ...q,
            order: index,
            points: parseFloat(q.points) || 0
          })),
          rubric: rubric
        }
      };

      const result = await apiClient.createAssignment(assignmentData);
      
      if (result) {
        router.push(`/classrooms/${formData.classroom_id}`);
      }
    } catch (error) {
      console.error('Error creating assignment:', error);
      setErrors({ general: 'Failed to create assignment. Please try again.' });
    } finally {
      setIsSubmitting(false);
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
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/dashboard"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <FaArrowLeft className="mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create New Assignment
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create an assignment with AI-powered grading capabilities
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                type="button"
                onClick={() => setActiveSection('basic')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeSection === 'basic'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <FaFileAlt className="inline mr-2" />
                Basic Information
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('questions')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeSection === 'questions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <FaPlus className="inline mr-2" />
                Questions ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('rubric')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  activeSection === 'rubric'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <FaTable className="inline mr-2" />
                Rubric {rubric && '✓'}
              </button>
            </nav>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {errors.general && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-600 dark:text-red-400 text-sm">
                {errors.general}
              </p>
            </div>
          )}

          {/* Basic Information */}
          {activeSection === 'basic' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Assignment Title */}
              <div className="md:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Math Quiz Chapter 5"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.title
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-200"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400`}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
                )}
              </div>

              {/* Classroom */}
              <div>
                <label htmlFor="classroom_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Classroom *
                </label>
                <select
                  id="classroom_id"
                  name="classroom_id"
                  value={formData.classroom_id}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.classroom_id
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-200"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                >
                  <option value="">Select a classroom</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name} {classroom.section && `(${classroom.section})`}
                    </option>
                  ))}
                </select>
                {errors.classroom_id && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.classroom_id}</p>
                )}
              </div>

              {/* Assignment Type */}
              <div>
                <label htmlFor="assignment_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assignment Type
                </label>
                <select
                  id="assignment_type"
                  name="assignment_type"
                  value={formData.assignment_type}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="homework">Homework</option>
                  <option value="quiz">Quiz</option>
                  <option value="exam">Exam</option>
                  <option value="project">Project</option>
                </select>
              </div>

              {/* Max Points */}
              <div>
                <label htmlFor="max_points" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Points
                </label>
                <input
                  type="number"
                  id="max_points"
                  name="max_points"
                  value={formData.max_points}
                  onChange={handleChange}
                  min="1"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.max_points
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-200"
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                />
                {errors.max_points && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.max_points}</p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  id="due_date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Brief description of the assignment..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                />
              </div>

              {/* Instructions */}
              <div className="md:col-span-2">
                <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Instructions
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  rows={4}
                  value={formData.instructions}
                  onChange={handleChange}
                  placeholder="Detailed instructions for students..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                />
              </div>

              {/* Auto Grade Toggle */}
              <div className="md:col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="auto_grade"
                    checked={formData.auto_grade}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <FaRobot className="inline mr-1 text-blue-500" />
                    Enable AI-powered auto-grading
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                  AI will automatically grade submissions based on the questions and criteria you define
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Questions */}
          {activeSection === 'questions' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Questions
              </h2>
              <button
                type="button"
                onClick={addQuestion}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaPlus className="mr-2" />
                Add Question
              </button>
            </div>

            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Question {index + 1}
                    </h3>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Question Text */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Question Text *
                      </label>
                      <textarea
                        rows={3}
                        value={question.question_text}
                        onChange={(e) => handleQuestionChange(index, 'question_text', e.target.value)}
                        placeholder="Enter your question here..."
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                          errors[`question_${index}`]
                            ? "border-red-500 focus:ring-red-200"
                            : "border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-200"
                        } bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none`}
                      />
                      {errors[`question_${index}`] && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[`question_${index}`]}</p>
                      )}
                    </div>

                    {/* Question Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Question Type
                      </label>
                      <select
                        value={question.question_type}
                        onChange={(e) => handleQuestionChange(index, 'question_type', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="short_answer">Short Answer</option>
                        <option value="essay">Essay</option>
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="math">Math Problem</option>
                      </select>
                    </div>

                    {/* Points */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Points
                      </label>
                      <input
                        type="number"
                        value={question.points}
                        onChange={(e) => handleQuestionChange(index, 'points', e.target.value)}
                        min="1"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {/* Grading Criteria */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Grading Criteria (for AI)
                      </label>
                      <textarea
                        rows={2}
                        value={question.grading_criteria}
                        onChange={(e) => handleQuestionChange(index, 'grading_criteria', e.target.value)}
                        placeholder="Describe what makes a good answer for AI grading..."
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-200 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Rubric */}
          {activeSection === 'rubric' && (
            <RubricBuilder 
              onRubricChange={setRubric}
              initialRubric={rubric}
              enableTemplates={true}
            />
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <Link
              href="/dashboard"
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <FaSave className="mr-2" />
                  Create Assignment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAssignment;