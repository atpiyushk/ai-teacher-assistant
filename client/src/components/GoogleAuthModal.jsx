// 'use client';

// import { useState } from 'react';
// import { FaGoogle, FaTimes } from 'react-icons/fa';

// const GoogleAuthModal = ({ isOpen, onClose, onConfirm }) => {
//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//       <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
//         {/* Header */}
//         <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
//           <div className="flex items-center space-x-3">
//             <FaGoogle className="text-red-500 text-xl" />
//             <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
//               Sign in with Google
//             </h2>
//           </div>
//           <button
//             onClick={onClose}
//             className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
//           >
//             <FaTimes />
//           </button>
//         </div>

//         {/* Content */}
//         <div className="p-6">
//           <div className="text-center mb-6">
//             <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
//               <FaGoogle className="text-blue-600 dark:text-blue-400 text-2xl" />
//             </div>
//             <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
//               Demo Mode Active
//             </h3>
//             <p className="text-gray-600 dark:text-gray-400 text-sm">
//               Google OAuth is not configured. This will create a demo teacher account for hackathon purposes.
//             </p>
//           </div>

//           {/* Demo Account Info */}
//           {/* <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
//             <h4 className="font-medium text-gray-900 dark:text-white mb-2">Demo Account:</h4>
//             <div className="text-sm text-gray-600 dark:text-gray-400">
//               <p>📧 hackathon@teacher.com</p>
//               <p>👤 Hackathon Demo Teacher</p>
//               <p>🎯 Ready to test AISensei features</p>
//             </div>
//           </div> */}

//           {/* Actions */}
//           <div className="flex space-x-3">
//             <button
//               onClick={onClose}
//               className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
//             >
//               Cancel
//             </button>
//             <button
//               onClick={onConfirm}
//               className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
//             >
//               <FaGoogle />
//               <span>Continue with Demo</span>
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default GoogleAuthModal;