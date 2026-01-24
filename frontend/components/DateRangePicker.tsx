import React, { useState, useEffect } from 'react';

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Helper to parse YYYY-MM-DD as local date to avoid timezone shifts
  const parseLocalDate = (str: string) => {
      if (!str) return new Date();
      const parts = str.split('-');
      if (parts.length !== 3) return new Date();
      const [y, m, d] = parts.map(Number);
      return new Date(y, m - 1, d);
  };
  
  // View state for the calendar (which month we are looking at)
  const [viewDate, setViewDate] = useState(() => parseLocalDate(startDate));

  // Local input state
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  useEffect(() => {
    setLocalStart(startDate);
    setLocalEnd(endDate);
  }, [startDate, endDate]);

  const handleInputChange = (type: 'start' | 'end', val: string) => {
    if (type === 'start') setLocalStart(val);
    else setLocalEnd(val);

    // Validate YYYY-MM-DD
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (regex.test(val)) {
        const d = parseLocalDate(val);
        if (!isNaN(d.getTime())) {
            if (type === 'start') onChange(val, endDate);
            else onChange(startDate, val);
            
            // Update view to the changed date
            setViewDate(d);
        }
    }
  };

  // Calendar Logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handleDayClick = (day: number) => {
    const clickedDate = new Date(currentYear, currentMonth, day);
    // Format as YYYY-MM-DD using local time
    const dateStr = [
        clickedDate.getFullYear(),
        String(clickedDate.getMonth() + 1).padStart(2, '0'),
        String(clickedDate.getDate()).padStart(2, '0')
    ].join('-');

    if (startDate !== endDate) {
        // Start new range
        onChange(dateStr, dateStr);
    } else {
        // Complete range
        // Compare using local dates
        const start = parseLocalDate(startDate);
        if (clickedDate < start) {
            onChange(dateStr, startDate);
        } else {
            onChange(startDate, dateStr);
        }
        // Do NOT close on click for hover-based UI
        // setIsOpen(false); 
    }
  };

  const changeMonth = (delta: number) => {
    setViewDate(new Date(currentYear, currentMonth + delta, 1));
  };

  const isDateInRange = (year: number, month: number, day: number) => {
      const d = new Date(year, month, day).getTime();
      const start = parseLocalDate(startDate).getTime();
      const end = parseLocalDate(endDate).getTime();
      return d > start && d < end;
  };

  const isDateSelected = (year: number, month: number, day: number) => {
      const d = new Date(year, month, day).getTime();
      const start = parseLocalDate(startDate).getTime();
      const end = parseLocalDate(endDate).getTime();
      return d === start || d === end;
  };

  return (
    <div 
        className="relative inline-block bg-base-100 rounded-lg shadow-lg border border-base-200 p-2" 
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
    >
      <div className="flex items-center gap-2">
         <input 
           type="text" 
           className="input input-sm input-ghost w-28 text-center px-0 focus:bg-base-200"
           value={localStart}
           onChange={(e) => handleInputChange('start', e.target.value)}
           placeholder="YYYY-MM-DD"
         />
         <span className="opacity-50">-</span>
         <input 
           type="text" 
           className="input input-sm input-ghost w-28 text-center px-0 focus:bg-base-200"
           value={localEnd}
           onChange={(e) => handleInputChange('end', e.target.value)}
           placeholder="YYYY-MM-DD"
         />
         <div 
            className="p-1.5 rounded hover:bg-base-200 cursor-pointer text-base-content/70 hover:text-primary transition-colors"
         >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
            </svg>
         </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full right-0 pt-2">
            <div 
                className="w-72 p-4 bg-base-100 rounded-xl shadow-xl border border-base-200 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
            >
                {/* Header */}
            <div className="flex justify-between items-center mb-4 px-1">
                <button 
                    onClick={(e) => { e.stopPropagation(); changeMonth(-1); }} 
                    className="btn btn-xs btn-ghost btn-circle"
                >
                    «
                </button>
                <span className="font-bold text-sm select-none">
                    {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); changeMonth(1); }} 
                    className="btn btn-xs btn-ghost btn-circle"
                >
                    »
                </button>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 mb-2 text-center text-xs opacity-50 font-mono">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
                {/* Empty slots for start of month */}
                {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}
                
                {/* Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const isSelected = isDateSelected(currentYear, currentMonth, day);
                    const inRange = isDateInRange(currentYear, currentMonth, day);
                    
                    let className = "btn btn-xs h-8 w-full font-normal border-0 transition-all p-0 ";
                    
                    if (isSelected) {
                        className += "btn-primary text-primary-content shadow-md ";
                    } else if (inRange) {
                        className += "bg-primary/10 text-primary hover:bg-primary/20 ";
                    } else {
                        className += "btn-ghost hover:bg-base-200 ";
                    }

                    return (
                        <button
                            key={day}
                            onClick={(e) => { e.stopPropagation(); handleDayClick(day); }}
                            className={className}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
      </div>
      )}
    </div>
  );
}
