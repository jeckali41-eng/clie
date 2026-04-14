import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X, ChevronLeft, ChevronRight, ChevronDown, Edit, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ScheduleRide: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showManualDateInput, setShowManualDateInput] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // Time picker state
  const [selectedHour, setSelectedHour] = useState(18);
  const [selectedMinute, setSelectedMinute] = useState(54);
  
  // Manual date input state
  const [manualDate, setManualDate] = useState('');

  useEffect(() => {
    // Set default date to today
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    
    // Format manual date input
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    setManualDate(`${day}/${month}/${year}`);
  }, []);

  const formatDate = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Today, ${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
    }
    
    return `${date.toLocaleDateString('en-US', { weekday: 'short' })}, ${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
  };

  const formatTimeDisplay = () => {
    if (!selectedTime) return 'Select';
    return selectedTime;
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3); // 3 months from now
    
    // Check if date is valid (not in the past and within 3 months)
    if (newDate >= today && newDate <= maxDate) {
      setSelectedDate(newDate);
      setShowDatePicker(false);
    }
  };

  const handleTimeConfirm = () => {
    const hour12 = selectedHour > 12 ? selectedHour - 12 : selectedHour === 0 ? 12 : selectedHour;
    const ampm = selectedHour >= 12 ? 'PM' : 'AM';
    const timeString = `${hour12}:${String(selectedMinute).padStart(2, '0')} ${ampm}`;
    setSelectedTime(timeString);
    setShowTimePicker(false);
  };

  const handleManualDateConfirm = () => {
    try {
      const [day, month, year] = manualDate.split('/').map(Number);
      const newDate = new Date(year, month - 1, day);
      const today = new Date();
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      
      if (newDate >= today && newDate <= maxDate) {
        setSelectedDate(newDate);
        setCurrentMonth(newDate.getMonth());
        setCurrentYear(newDate.getFullYear());
        setShowManualDateInput(false);
      }
    } catch (error) {
      console.error('Invalid date format');
    }
  };

  const handleContinue = () => {
    if (selectedTime) {
      navigate('/schedule-your-route');
    }
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    
    const days = [];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    // Add day headers
    dayNames.forEach(day => {
      days.push(
        <div key={day} className="text-center text-gray-500 font-medium py-2">
          {day}
        </div>
      );
    });
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isSelected = selectedDate.toDateString() === date.toDateString();
      const isDisabled = date < today || date > maxDate;
      const isToday = date.toDateString() === today.toDateString();
      
      days.push(
        <button
          key={day}
          onClick={() => !isDisabled && handleDateSelect(day)}
          disabled={isDisabled}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
            isSelected
              ? 'bg-green-600 text-white'
              : isToday
              ? 'bg-green-100 text-green-600'
              : isDisabled
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {day}
        </button>
      );
    }
    
    return days;
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const years = [currentYear];
    
    // If we're in the last 3 months of the year, include next year
    if (currentMonth >= 9) { // October, November, December
      years.push(currentYear + 1);
    }
    
    return years;
  };

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    
    if (direction === 'next') {
      if (currentMonth === 11) {
        const newYear = currentYear + 1;
        if (newYear <= maxDate.getFullYear()) {
          setCurrentMonth(0);
          setCurrentYear(newYear);
        }
      } else {
        const newDate = new Date(currentYear, currentMonth + 1, 1);
        if (newDate <= maxDate) {
          setCurrentMonth(currentMonth + 1);
        }
      }
    } else {
      if (currentMonth === 0) {
        const newYear = currentYear - 1;
        if (newYear >= today.getFullYear()) {
          setCurrentMonth(11);
          setCurrentYear(newYear);
        }
      } else {
        const newDate = new Date(currentYear, currentMonth - 1, 1);
        if (newDate >= new Date(today.getFullYear(), today.getMonth(), 1)) {
          setCurrentMonth(currentMonth - 1);
        }
      }
    }
  };

  return (
    <motion.div 
      className="min-h-screen bg-gray-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <motion.div 
        className="bg-white p-4 shadow-sm"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} className="text-gray-800" />
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <motion.div 
        className="p-6 space-y-8"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Header Text */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select pickup time</h1>
          <p className="text-gray-600">From 30 minutes, up to 90 days in advance</p>
        </div>

        {/* Date Selection */}
        <div className="space-y-4">
          <label className="block text-lg font-medium text-gray-900">Date</label>
          <button
            onClick={() => setShowDatePicker(true)}
            className="w-full bg-gray-100 rounded-xl p-4 text-left hover:bg-gray-200 transition-colors flex items-center justify-between"
          >
            <span className="text-gray-900 font-medium">{formatDate(selectedDate)}</span>
          </button>
        </div>

        {/* Time Selection */}
        <div className="space-y-4">
          <label className="block text-lg font-medium text-gray-900">Pickup time</label>
          <button
            onClick={() => setShowTimePicker(true)}
            className="w-full bg-gray-100 rounded-xl p-4 text-left hover:bg-gray-200 transition-colors flex items-center justify-between"
          >
            <span className={`${selectedTime ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              {formatTimeDisplay()}
            </span>
            <span className="text-green-600 font-medium">Select</span>
          </button>
        </div>

        {/* Terms Link */}
        <button className="text-green-600 font-medium">
          Terms of Scheduled Rides
        </button>
      </motion.div>

      {/* Continue Button */}
      <motion.div 
        className="fixed bottom-6 left-6 right-6"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <button
          onClick={handleContinue}
          disabled={!selectedTime}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            selectedTime 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </motion.div>

      {/* Calendar Modal */}
      <AnimatePresence>
        {showDatePicker && (
          <motion.div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-white rounded-2xl overflow-hidden max-w-sm w-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              {/* Calendar Header */}
              <div className="bg-green-600 text-white p-4">
                <div className="text-sm font-medium mb-1">SELECT DATE</div>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-light">
                    {selectedDate.toLocaleDateString('en-US', { month: 'short' })} {selectedDate.getDate()}, {selectedDate.getFullYear()}
                  </div>
                  <button
                    onClick={() => setShowManualDateInput(true)}
                    className="p-2 hover:bg-green-700 rounded-full transition-colors"
                  >
                    <Edit size={20} />
                  </button>
                </div>
              </div>

              {/* Calendar Navigation */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setShowYearPicker(true)}
                    className="flex items-center space-x-1 text-gray-700 hover:bg-gray-100 px-2 py-1 rounded"
                  >
                    <span className="font-medium">{monthNames[currentMonth]} {currentYear}</span>
                    <ChevronDown size={16} />
                  </button>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {renderCalendar()}
                </div>
              </div>

              {/* Calendar Actions */}
              <div className="p-4 flex justify-end space-x-4">
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="text-green-600 font-medium px-4 py-2 hover:bg-green-50 rounded transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="text-green-600 font-medium px-4 py-2 hover:bg-green-50 rounded transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time Picker Modal */}
      <AnimatePresence>
        {showTimePicker && (
          <motion.div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-white rounded-2xl p-6 max-w-sm w-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h3 className="text-lg font-medium text-gray-700 mb-6 text-center">
                SELECT TIME
              </h3>
              
              <div className="flex items-center justify-center space-x-4 mb-8">
                {/* Hour Picker */}
                <div className="text-center">
                  <div className="border-2 border-green-600 rounded-lg p-4 mb-2">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={selectedHour}
                      onChange={(e) => setSelectedHour(parseInt(e.target.value) || 0)}
                      className="text-4xl font-light text-center w-16 bg-transparent outline-none"
                    />
                  </div>
                  <div className="text-sm text-gray-500">Hour</div>
                </div>

                <div className="text-4xl font-light text-gray-400">:</div>

                {/* Minute Picker */}
                <div className="text-center">
                  <div className="bg-gray-100 rounded-lg p-4 mb-2">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={selectedMinute}
                      onChange={(e) => setSelectedMinute(parseInt(e.target.value) || 0)}
                      className="text-4xl font-light text-center w-16 bg-transparent outline-none"
                    />
                  </div>
                  <div className="text-sm text-gray-500">Minute</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Clock size={24} className="text-gray-400" />
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowTimePicker(false)}
                    className="text-green-600 font-medium px-4 py-2 hover:bg-green-50 rounded transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleTimeConfirm}
                    className="text-green-600 font-medium px-4 py-2 hover:bg-green-50 rounded transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Date Input Modal */}
      <AnimatePresence>
        {showManualDateInput && (
          <motion.div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-white rounded-2xl overflow-hidden max-w-sm w-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              {/* Header */}
              <div className="bg-green-600 text-white p-4">
                <div className="text-sm font-medium mb-1">SELECT DATE</div>
                <div className="text-2xl font-light">
                  {selectedDate.toLocaleDateString('en-US', { month: 'short' })} {selectedDate.getDate()}, {selectedDate.getFullYear()}
                </div>
              </div>

              {/* Input Section */}
              <div className="p-6">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="text-sm text-green-600 font-medium mb-2">Date</div>
                  <input
                    type="text"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full text-lg font-medium bg-transparent outline-none border-b-2 border-green-600 pb-1"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 flex justify-end space-x-4">
                <button
                  onClick={() => setShowManualDateInput(false)}
                  className="text-green-600 font-medium px-4 py-2 hover:bg-green-50 rounded transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleManualDateConfirm}
                  className="text-green-600 font-medium px-4 py-2 hover:bg-green-50 rounded transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Year Picker Modal */}
      <AnimatePresence>
        {showYearPicker && (
          <motion.div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-white rounded-2xl p-6 max-w-sm w-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
                Select Year
              </h3>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getAvailableYears().map((year) => (
                  <button
                    key={year}
                    onClick={() => {
                      setCurrentYear(year);
                      setShowYearPicker(false);
                    }}
                    className={`w-full p-3 rounded-lg text-left hover:bg-green-100 transition-colors ${
                      currentYear === year ? 'bg-green-600 text-white' : 'text-gray-900'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowYearPicker(false)}
                className="w-full mt-4 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};