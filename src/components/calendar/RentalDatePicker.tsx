import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RentalService } from '../../services/firestore';

interface RentalDatePickerProps {
  itemId: string;
  selectedStartDate?: Date | null;
  selectedEndDate?: Date | null;
  onDateRangeSelect: (startDate: Date, endDate: Date) => void;
  minRentalDays?: number;
  maxRentalDays?: number;
}

const RentalDatePicker: React.FC<RentalDatePickerProps> = ({
  itemId,
  selectedStartDate,
  selectedEndDate,
  onDateRangeSelect,
  minRentalDays = 1,
  maxRentalDays = 30,
}) => {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(selectedStartDate || null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(selectedEndDate || null);

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    loadBookedDates();
  }, [itemId]);

  // Only sync from props on initial mount, not on every change
  // This prevents parent updates from interfering with our selection flow
  useEffect(() => {
    if (selectedStartDate && !tempStartDate) {
      setTempStartDate(selectedStartDate);
    }
    if (selectedEndDate && !tempEndDate) {
      setTempEndDate(selectedEndDate);
    }
  }, []);

  const loadBookedDates = async () => {
    try {
      setLoading(true);
      const rentals = await RentalService.getRentalsByItem(itemId);

      const booked: string[] = [];
      rentals.forEach(rental => {
        if (rental.status === 'approved' || rental.status === 'active') {
          const start = rental.dates.confirmedStart || rental.dates.requestedStart;
          const end = rental.dates.confirmedEnd || rental.dates.requestedEnd;

          if (start && end) {
            const toDateObj = (val: any): Date => {
              if (val instanceof Date) return val;
              if (val && typeof val.toDate === 'function') return val.toDate();
              if (val && typeof val.seconds === 'number') return new Date(val.seconds * 1000);
              return new Date(val);
            };
            const startDate = toDateObj(start);
            const endDate = toDateObj(end);

            const current = new Date(startDate);
            while (current <= endDate) {
              booked.push(formatDateString(current));
              current.setDate(current.getDate() + 1);
            }
          }
        }
      });

      setBookedDates(booked);
    } catch (error) {
      // Silently handle permission errors - calendar will work without booked dates
      console.log('Note: Could not load booked dates. Calendar will show all dates as available.');
    } finally {
      setLoading(false);
    }
  };

  // Fixed: Ensure consistent date formatting without timezone issues
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fixed: Parse date string correctly to local date
  const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const isDateBooked = (dateString: string): boolean => {
    return bookedDates.includes(dateString);
  };

  const isDateInPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isDateInRange = (dateString: string): boolean => {
    if (!tempStartDate || !tempEndDate) return false;
    const date = parseDateString(dateString);
    date.setHours(0, 0, 0, 0);
    const start = new Date(tempStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(tempEndDate);
    end.setHours(0, 0, 0, 0);
    return date >= start && date <= end;
  };

  const isDateRangeStart = (dateString: string): boolean => {
    if (!tempStartDate) return false;
    return formatDateString(tempStartDate) === dateString;
  };

  const isDateRangeEnd = (dateString: string): boolean => {
    if (!tempEndDate) return false;
    return formatDateString(tempEndDate) === dateString;
  };

  const handleDatePress = (dateString: string) => {
    const date = parseDateString(dateString);
    date.setHours(0, 0, 0, 0);

    // Prevent selecting past or booked dates
    if (isDateBooked(dateString) || isDateInPast(date)) {
      return;
    }

    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      // Starting new selection - only set start date, but trigger callback for 1-day rental
      setTempStartDate(date);
      setTempEndDate(null);
      
      // Auto-confirm 1-day rental if it meets minimum requirements
      if (minRentalDays <= 1) {
        onDateRangeSelect(date, date);
      }
    } else if (formatDateString(date) === formatDateString(tempStartDate)) {
      // User clicked the same date again - confirm it as 1-day rental
      setTempEndDate(date);
      if (minRentalDays <= 1) {
        onDateRangeSelect(date, date);
      }
      return;
    } else {
      // Selecting end date
      const start = new Date(tempStartDate);
      start.setHours(0, 0, 0, 0);
      
      if (date < start) {
        // User selected earlier date, swap them
        setTempEndDate(start);
        setTempStartDate(date);
        
        // Validate and auto-confirm
        const days = Math.ceil((start.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (days >= minRentalDays && days <= maxRentalDays) {
          onDateRangeSelect(date, start);
        }
      } else {
        // Check if there are any booked dates in between
        let hasBlockedDate = false;
        const checkDate = new Date(start);
        while (checkDate <= date) {
          const checkString = formatDateString(checkDate);
          if (isDateBooked(checkString)) {
            hasBlockedDate = true;
            break;
          }
          checkDate.setDate(checkDate.getDate() + 1);
        }

        if (hasBlockedDate) {
          // Reset selection if blocked dates in between
          setTempStartDate(date);
          setTempEndDate(null);
        } else {
          // Validate rental duration
          const days = Math.ceil((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

          if (days < minRentalDays) {
            alert(`Minimum rental period is ${minRentalDays} day(s)`);
            return;
          }

          if (days > maxRentalDays) {
            alert(`Maximum rental period is ${maxRentalDays} day(s)`);
            return;
          }

          setTempEndDate(date);
          // Automatically call the callback when both dates are selected
          onDateRangeSelect(tempStartDate, date);
        }
      }
    }
  };

  const clearSelection = () => {
    setTempStartDate(null);
    setTempEndDate(null);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = direction === 'prev'
      ? new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
      : new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    
    setCurrentMonth(newMonth);
  };

  // Quick selection handler
  const handleQuickSelect = (days: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const start = tempStartDate || today;
    const end = new Date(start);
    end.setDate(start.getDate() + days - 1);
    
    setTempStartDate(start);
    setTempEndDate(end);
    
    // Auto-confirm the selection
    onDateRangeSelect(start, end);
  };

  // Check if quick selection is available
  const isQuickSelectAvailable = (days: number): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = tempStartDate || today;
    
    for (let i = 0; i < days; i++) {
      const checkDate = new Date(start);
      checkDate.setDate(checkDate.getDate() + i);
      const dateString = formatDateString(checkDate);
      
      if (isDateBooked(dateString) || isDateInPast(checkDate)) {
        return false;
      }
    }
    return days >= minRentalDays && days <= maxRentalDays;
  };

  const renderDay = (date: Date | null, index: number) => {
    if (!date) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const dateString = formatDateString(date);
    const isBooked = isDateBooked(dateString);
    const isPast = isDateInPast(date);
    const isInRange = isDateInRange(dateString);
    const isRangeStart = isDateRangeStart(dateString);
    const isRangeEnd = isDateRangeEnd(dateString);
    
    // Disable dates beyond maxRentalDays from selected start date
    let isBeyondMaxRange = false;
    if (tempStartDate && !tempEndDate) {
      const daysDiff = Math.ceil((date.getTime() - tempStartDate.getTime()) / (1000 * 60 * 60 * 24));
      isBeyondMaxRange = daysDiff >= maxRentalDays;
    }
    
    const isDisabled = isPast || isBooked || isBeyondMaxRange;

    return (
      <TouchableOpacity
        key={dateString}
        style={[
          styles.dayCell,
          isRangeStart && styles.rangeStart,
          isRangeEnd && styles.rangeEnd,
          isInRange && !isRangeStart && !isRangeEnd && styles.inRange,
        ]}
        onPress={() => handleDatePress(dateString)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <View style={[
          styles.dayContent,
          (isRangeStart || isRangeEnd) && styles.dayContentSelected,
        ]}>
          <Text style={[
            styles.dayText,
            isDisabled && styles.dayTextDisabled,
            (isRangeStart || isRangeEnd) && styles.dayTextSelected,
            isInRange && !isRangeStart && !isRangeEnd && styles.dayTextInRange,
          ]}>
            {date.getDate()}
          </Text>
        </View>
        {isBooked && (
          <View style={styles.bookedLine} />
        )}
      </TouchableOpacity>
    );
  };

  const renderLegend = () => (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#4639eb' }]} />
        <Text style={styles.legendText}>Selected</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#EEF2FF' }]} />
        <Text style={styles.legendText}>In Range</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' }]} />
        <Text style={styles.legendText}>Unavailable</Text>
      </View>
    </View>
  );

  const selectedDays = tempStartDate && tempEndDate
    ? Math.ceil((tempEndDate.getTime() - tempStartDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const currentMonthDays = getDaysInMonth(currentMonth);
  const quickSelectOptions = [
    { days: 1, label: '1 day' },
    { days: 3, label: '3 days' },
    { days: 7, label: '1 week' },
    { days: 14, label: '2 weeks' },
    { days: 30, label: '1 month' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4639eb" />
        <Text style={styles.loadingText}>Loading availability...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Quick Selection Pills */}
      <View style={styles.quickSelectContainer}>
        <Text style={styles.quickSelectTitle}>Quick select:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickSelectScroll}
        >
          {quickSelectOptions.map(option => {
            const isAvailable = isQuickSelectAvailable(option.days);
            return (
              <TouchableOpacity
                key={option.days}
                style={[
                  styles.quickSelectPill,
                  isAvailable ? styles.quickSelectPillActive : styles.quickSelectPillDisabled,
                ]}
                disabled={!isAvailable}
                onPress={() => handleQuickSelect(option.days)}
              >
                <Text style={[
                  styles.quickSelectText,
                  isAvailable ? styles.quickSelectTextActive : styles.quickSelectTextDisabled,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Calendar Month */}
      <View style={styles.calendarContainer}>
        <View style={styles.monthHeader}>
          <TouchableOpacity 
            onPress={() => navigateMonth('prev')}
            style={styles.navButton}
          >
            <Ionicons name="chevron-back" size={24} color="#4639eb" />
          </TouchableOpacity>
          
          <Text style={styles.monthText}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          
          <TouchableOpacity 
            onPress={() => navigateMonth('next')}
            style={styles.navButton}
          >
            <Ionicons name="chevron-forward" size={24} color="#4639eb" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.daysHeader}>
          {daysOfWeek.map(day => (
            <View key={day} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.calendarGrid}>
          {currentMonthDays.map((date, index) => renderDay(date, index))}
        </View>
      </View>

      {/* Legend */}
      {renderLegend()}

      {/* Selection Summary */}
      {(tempStartDate || tempEndDate) && (
        <View style={styles.selectionSummary}>
          <View style={styles.summaryGrid}>
            <View style={styles.dateCard}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <View style={styles.dateValueContainer}>
                <Ionicons name="calendar" size={18} color="#4639eb" />
                <Text style={styles.dateValue}>
                  {tempStartDate 
                    ? tempStartDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'Not selected'}
                </Text>
              </View>
            </View>
            
            <View style={styles.dateCard}>
              <Text style={styles.dateLabel}>End Date</Text>
              <View style={styles.dateValueContainer}>
                <Ionicons name="calendar" size={18} color="#4639eb" />
                <Text style={styles.dateValue}>
                  {tempEndDate 
                    ? tempEndDate.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'Not selected'}
                </Text>
              </View>
            </View>
          </View>
          
          {tempStartDate && tempEndDate && (
            <View style={styles.durationContainer}>
              <View style={styles.durationBadge}>
                <Ionicons name="time-outline" size={18} color="#4639eb" />
                <Text style={styles.durationText}>
                  {selectedDays} {selectedDays === 1 ? 'day' : 'days'} rental period
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Clear Button */}
      {(tempStartDate || tempEndDate) && (
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={clearSelection}
        >
          <Text style={styles.clearButtonText}>
            Clear Selection
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    maxWidth: 450,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  
  // Quick Selection
  quickSelectContainer: {
    marginBottom: 20,
  },
  quickSelectTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickSelectScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  quickSelectPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  quickSelectPillActive: {
    backgroundColor: '#4639eb',
    borderColor: '#4639eb',
  },
  quickSelectPillDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  quickSelectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickSelectTextActive: {
    color: '#FFFFFF',
  },
  quickSelectTextDisabled: {
    color: '#D1D5DB',
  },

  // Calendar
  calendarContainer: {
    marginBottom: 20,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  monthText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.2,
  },
  daysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285714%',
    aspectRatio: 1,
    padding: 2,
  },
  dayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  dayContentSelected: {
    backgroundColor: '#4639eb',
  },
  rangeStart: {
    backgroundColor: '#EEF2FF',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  rangeEnd: {
    backgroundColor: '#EEF2FF',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  inRange: {
    backgroundColor: '#EEF2FF',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  dayTextDisabled: {
    color: '#D1D5DB',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayTextInRange: {
    color: '#4639eb',
  },
  bookedLine: {
    position: 'absolute',
    bottom: 6,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#EF4444',
    borderRadius: 1,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Selection Summary
  selectionSummary: {
    marginBottom: 20,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dateValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    flex: 1,
  },
  durationContainer: {
    alignItems: 'center',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  durationText: {
    fontSize: 13,
    color: '#4639eb',
    fontWeight: '700',
  },

  // Actions
  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  clearButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
});

export default RentalDatePicker;
