"use client";
import React, { useState } from "react";
import { 
  FaPlus, 
  FaTrash, 
  FaEdit, 
  FaSave,
  FaEye,
  FaCopy,
  FaChevronDown,
  FaChevronUp
} from "react-icons/fa";

const RubricBuilder = ({ 
  onRubricChange, 
  initialRubric = null,
  enableTemplates = true 
}) => {
  const [rubric, setRubric] = useState(initialRubric || {
    title: "",
    description: "",
    criteria: [
      {
        description: "",
        points: 25,
        levels: [
          { title: "Excellent", description: "", points: 25 },
          { title: "Good", description: "", points: 20 },
          { title: "Satisfactory", description: "", points: 15 },
          { title: "Needs Improvement", description: "", points: 10 }
        ]
      }
    ]
  });

  const [expandedCriteria, setExpandedCriteria] = useState(new Set([0]));
  const [showTemplates, setShowTemplatesState] = useState(false);

  // Predefined templates
  const templates = [
    {
      name: "Essay Writing Rubric",
      description: "Comprehensive rubric for written essays",
      criteria: [
        {
          description: "Organization and Structure",
          points: 25,
          levels: [
            { title: "Excellent", description: "Clear introduction, body, and conclusion with logical flow", points: 25 },
            { title: "Good", description: "Generally well-organized with minor issues", points: 20 },
            { title: "Satisfactory", description: "Adequate organization with some confusion", points: 15 },
            { title: "Needs Improvement", description: "Poor organization that affects understanding", points: 10 }
          ]
        },
        {
          description: "Content and Ideas",
          points: 25,
          levels: [
            { title: "Excellent", description: "Original, insightful ideas with strong supporting evidence", points: 25 },
            { title: "Good", description: "Clear ideas with adequate support", points: 20 },
            { title: "Satisfactory", description: "Basic ideas with minimal support", points: 15 },
            { title: "Needs Improvement", description: "Unclear or unsupported ideas", points: 10 }
          ]
        },
        {
          description: "Grammar and Mechanics",
          points: 25,
          levels: [
            { title: "Excellent", description: "Virtually error-free with varied sentence structure", points: 25 },
            { title: "Good", description: "Minor errors that don't interfere with meaning", points: 20 },
            { title: "Satisfactory", description: "Some errors but generally readable", points: 15 },
            { title: "Needs Improvement", description: "Frequent errors that interfere with comprehension", points: 10 }
          ]
        },
        {
          description: "Voice and Style",
          points: 25,
          levels: [
            { title: "Excellent", description: "Engaging voice appropriate for audience and purpose", points: 25 },
            { title: "Good", description: "Clear voice with some personality", points: 20 },
            { title: "Satisfactory", description: "Adequate voice but may be inconsistent", points: 15 },
            { title: "Needs Improvement", description: "Weak or inappropriate voice", points: 10 }
          ]
        }
      ]
    },
    {
      name: "Math Problem Solving",
      description: "Rubric for mathematical problem-solving skills",
      criteria: [
        {
          description: "Problem Understanding",
          points: 25,
          levels: [
            { title: "Complete", description: "Demonstrates complete understanding of the problem", points: 25 },
            { title: "Substantial", description: "Demonstrates substantial understanding", points: 20 },
            { title: "Partial", description: "Demonstrates partial understanding", points: 15 },
            { title: "Little", description: "Demonstrates little understanding", points: 10 }
          ]
        },
        {
          description: "Mathematical Procedures",
          points: 25,
          levels: [
            { title: "Complete", description: "Uses efficient and effective procedures", points: 25 },
            { title: "Substantial", description: "Uses mostly effective procedures with minor errors", points: 20 },
            { title: "Partial", description: "Uses some effective procedures but with errors", points: 15 },
            { title: "Little", description: "Uses ineffective or incorrect procedures", points: 10 }
          ]
        },
        {
          description: "Mathematical Communication",
          points: 25,
          levels: [
            { title: "Complete", description: "Clear, precise mathematical language and notation", points: 25 },
            { title: "Substantial", description: "Generally clear with minor communication issues", points: 20 },
            { title: "Partial", description: "Some unclear or imprecise communication", points: 15 },
            { title: "Little", description: "Unclear or incorrect mathematical communication", points: 10 }
          ]
        },
        {
          description: "Accuracy of Solution",
          points: 25,
          levels: [
            { title: "Complete", description: "Correct answer with accurate calculations", points: 25 },
            { title: "Substantial", description: "Mostly correct with minor calculation errors", points: 20 },
            { title: "Partial", description: "Some correct elements but significant errors", points: 15 },
            { title: "Little", description: "Incorrect answer with major errors", points: 10 }
          ]
        }
      ]
    }
  ];

  const updateRubric = (newRubric) => {
    setRubric(newRubric);
    if (onRubricChange) {
      onRubricChange(newRubric);
    }
  };

  const handleBasicInfoChange = (field, value) => {
    const updated = { ...rubric, [field]: value };
    updateRubric(updated);
  };

  const addCriterion = () => {
    const newCriterion = {
      description: "",
      points: 25,
      levels: [
        { title: "Excellent", description: "", points: 25 },
        { title: "Good", description: "", points: 20 },
        { title: "Satisfactory", description: "", points: 15 },
        { title: "Needs Improvement", description: "", points: 10 }
      ]
    };
    
    const updated = {
      ...rubric,
      criteria: [...rubric.criteria, newCriterion]
    };
    updateRubric(updated);
    
    // Expand the new criterion
    const newIndex = rubric.criteria.length;
    setExpandedCriteria(prev => new Set([...prev, newIndex]));
  };

  const removeCriterion = (index) => {
    if (rubric.criteria.length > 1) {
      const updated = {
        ...rubric,
        criteria: rubric.criteria.filter((_, i) => i !== index)
      };
      updateRubric(updated);
      
      // Update expanded criteria indices
      setExpandedCriteria(prev => {
        const newSet = new Set();
        prev.forEach(i => {
          if (i < index) newSet.add(i);
          else if (i > index) newSet.add(i - 1);
        });
        return newSet;
      });
    }
  };

  const updateCriterion = (criterionIndex, field, value) => {
    const updated = {
      ...rubric,
      criteria: rubric.criteria.map((criterion, i) => 
        i === criterionIndex ? { ...criterion, [field]: value } : criterion
      )
    };
    updateRubric(updated);
  };

  const addLevel = (criterionIndex) => {
    const newLevel = { title: "", description: "", points: 0 };
    const updated = {
      ...rubric,
      criteria: rubric.criteria.map((criterion, i) => 
        i === criterionIndex 
          ? { ...criterion, levels: [...criterion.levels, newLevel] }
          : criterion
      )
    };
    updateRubric(updated);
  };

  const removeLevel = (criterionIndex, levelIndex) => {
    const criterion = rubric.criteria[criterionIndex];
    if (criterion.levels.length > 2) {
      const updated = {
        ...rubric,
        criteria: rubric.criteria.map((criterion, i) => 
          i === criterionIndex 
            ? { ...criterion, levels: criterion.levels.filter((_, j) => j !== levelIndex) }
            : criterion
        )
      };
      updateRubric(updated);
    }
  };

  const updateLevel = (criterionIndex, levelIndex, field, value) => {
    const updated = {
      ...rubric,
      criteria: rubric.criteria.map((criterion, i) => 
        i === criterionIndex 
          ? {
              ...criterion,
              levels: criterion.levels.map((level, j) => 
                j === levelIndex ? { ...level, [field]: value } : level
              )
            }
          : criterion
      )
    };
    updateRubric(updated);
  };

  const toggleCriterionExpansion = (index) => {
    setExpandedCriteria(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const applyTemplate = (template) => {
    const updated = {
      title: template.name,
      description: template.description,
      criteria: template.criteria
    };
    updateRubric(updated);
    setExpandedCriteria(new Set(template.criteria.map((_, i) => i)));
    setShowTemplatesState(false);
  };

  const calculateTotalPoints = () => {
    return rubric.criteria.reduce((total, criterion) => total + (criterion.points || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      {enableTemplates && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
              Rubric Templates
            </h3>
            <button
              onClick={() => setShowTemplatesState(!showTemplates)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800"
            >
              {showTemplates ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          </div>
          
          {showTemplates && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((template, index) => (
                <div 
                  key={index}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => applyTemplate(template)}
                >
                  <h4 className="font-medium text-gray-900 dark:text-white">{template.name}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{template.description}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    {template.criteria.length} criteria • Click to apply
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Rubric Information
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rubric Title *
            </label>
            <input
              type="text"
              value={rubric.title}
              onChange={(e) => handleBasicInfoChange('title', e.target.value)}
              placeholder="e.g., Essay Evaluation Rubric"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              rows={2}
              value={rubric.description}
              onChange={(e) => handleBasicInfoChange('description', e.target.value)}
              placeholder="Brief description of what this rubric evaluates..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Total Points: <span className="font-medium">{calculateTotalPoints()}</span>
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Criteria: <span className="font-medium">{rubric.criteria.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Criteria */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Assessment Criteria
          </h3>
          <button
            onClick={addCriterion}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaPlus className="mr-2" />
            Add Criterion
          </button>
        </div>

        <div className="space-y-4">
          {rubric.criteria.map((criterion, criterionIndex) => (
            <div key={criterionIndex} className="border border-gray-200 dark:border-gray-700 rounded-lg">
              {/* Criterion Header */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleCriterionExpansion(criterionIndex)}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    {expandedCriteria.has(criterionIndex) ? <FaChevronUp /> : <FaChevronDown />}
                  </button>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Criterion {criterionIndex + 1}
                    {criterion.description && `: ${criterion.description.substring(0, 50)}${criterion.description.length > 50 ? '...' : ''}`}
                  </h4>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {criterion.points} points
                  </span>
                  {rubric.criteria.length > 1 && (
                    <button
                      onClick={() => removeCriterion(criterionIndex)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>

              {/* Criterion Content */}
              {expandedCriteria.has(criterionIndex) && (
                <div className="p-4 space-y-4">
                  {/* Criterion Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        What are you assessing? *
                      </label>
                      <input
                        type="text"
                        value={criterion.description}
                        onChange={(e) => updateCriterion(criterionIndex, 'description', e.target.value)}
                        placeholder="e.g., Organization and Structure"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max Points *
                      </label>
                      <input
                        type="number"
                        value={criterion.points}
                        onChange={(e) => updateCriterion(criterionIndex, 'points', parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Performance Levels */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Performance Levels
                      </label>
                      <button
                        onClick={() => addLevel(criterionIndex)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        <FaPlus className="inline mr-1" /> Add Level
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {criterion.levels.map((level, levelIndex) => (
                        <div key={levelIndex} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                          <div>
                            <input
                              type="text"
                              value={level.title}
                              onChange={(e) => updateLevel(criterionIndex, levelIndex, 'title', e.target.value)}
                              placeholder="Level name"
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          
                          <div className="md:col-span-2">
                            <input
                              type="text"
                              value={level.description}
                              onChange={(e) => updateLevel(criterionIndex, levelIndex, 'description', e.target.value)}
                              placeholder="Description of this performance level"
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={level.points}
                              onChange={(e) => updateLevel(criterionIndex, levelIndex, 'points', parseInt(e.target.value) || 0)}
                              min="0"
                              max={criterion.points}
                              className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {criterion.levels.length > 2 && (
                              <button
                                onClick={() => removeLevel(criterionIndex, levelIndex)}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RubricBuilder;