import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CalendarDate {
  date: string; // YYYY-MM-DD format
  available: boolean;
  price?: number;
}

interface AvailabilityCalendarProps {
  selectedDates?: CalendarDate[];
  onDateSelect?: (dates: CalendarDate[]) => void;
  mode?: 'select' | 'view';
  minDate?: Date;
  maxDate?: Date;
  blockedDates?: string[];
  bookedDates?: string[];
  defaultPrice?: number;
}

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  selectedDates = [],
  onDateSelect,
  mode = 'select',
  minDate = new Date(),
  maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  blockedDates = [],
  bookedDates = [],
  defaultPrice = 0,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDates, setCalendarDates] = useState<CalendarDate[]>(selectedDates);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    setCalendarDates(selectedDates);
  }, [selectedDates]);

  const formatDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getDateStatus = (dateString: string) => {
    if (blockedDates.includes(dateString)) return 'blocked';
    if (bookedDates.includes(dateString)) return 'booked';
    
    const dateData = calendarDates.find(d => d.date === dateString);
    if (dateData?.available) return 'available';
    
    return 'unavailable';
  };

  const toggleDateAvailability = (dateString: string) => {
    if (mode === 'view') return;
    if (blockedDates.includes(dateString) || bookedDates.includes(dateString)) return;

    const existingDate = calendarDates.find(d => d.date === dateString);
    let newDates: CalendarDate[];

    if (existingDate) {
      newDates = calendarDates.map(d =>
        d.date === dateString
          ? { ...d, available: !d.available }
          : d
      );
    } else {
      newDates = [
        ...calendarDates,
        {
          date: dateString,
          available: true,
          price: defaultPrice,
        }
      ];
    }

    setCalendarDates(newDates);
    onDateSelect?.(newDates);
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
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const isDateDisabled = (date: Date): boolean => {
    return date < minDate || date > maxDate;
  };

  const renderDay = (date: Date | null, index: number) => {
    if (!date) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const dateString = formatDateString(date);
    const status = getDateStatus(dateString);
    const isDisabled = isDateDisabled(date);
    const dateData = calendarDates.find(d => d.date === dateString);

    let backgroundColor = '#FFFFFF';
    let textColor = '#111827';

    if (isDisabled) {
      backgroundColor = '#F9FAFB';
      textColor = '#D1D5DB';
    } else {
      switch (status) {
        case 'available':
          backgroundColor = '#10B981';
          textColor = '#FFFFFF';
          break;
        case 'blocked':
          backgroundColor = '#6B7280';
          textColor = '#FFFFFF';
          break;
        case 'booked':
          backgroundColor = '#EF4444';
          textColor = '#FFFFFF';
          break;
        default:
          backgroundColor = '#F3F4F6';
          break;
      }
    }

    const cellStyle = [styles.dayCell, { backgroundColor }];

    return (
      <TouchableOpacity
        key={dateString}
        style={cellStyle}
        onPress={() => !isDisabled && toggleDateAvailability(dateString)}
        disabled={isDisabled}
      >
        <Text style={[styles.dayText, { color: textColor }]}>
          {date.getDate()}
        </Text>
        {dateData?.price && dateData.price > 0 && (
          <Text style={styles.priceText}>${dateData.price}</Text>
        )}
        {status === 'booked' && (
          <View style={styles.statusIndicator}>
            <Ionicons name="calendar" size={8} color="#FFFFFF" />
          </View>
        )}
        {status === 'blocked' && (
          <View style={styles.statusIndicator}>
            <Ionicons name="close" size={8} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderLegend = () => (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#10B981' }]} />
        <Text style={styles.legendText}>Available</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#F3F4F6' }]} />
        <Text style={styles.legendText}>Unavailable</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
        <Text style={styles.legendText}>Booked</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendColor, { backgroundColor: '#6B7280' }]} />
        <Text style={styles.legendText}>Blocked</Text>
      </View>
    </View>
  );

  const days = getDaysInMonth(currentMonth);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateMonth('prev')}>
          <Ionicons name="chevron-back" size={24} color="#4639eb" />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={() => navigateMonth('next')}>
          <Ionicons name="chevron-forward" size={24} color="#4639eb" />
        </TouchableOpacity>
      </View>

      {/* Days of week header */}
      <View style={styles.daysHeader}>
        {daysOfWeek.map(day => (
          <Text key={day} style={styles.dayHeaderText}>
            {day}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {days.map((date, index) => renderDay(date, index))}
      </View>

      {/* Legend */}
      {renderLegend()}

      {/* Instructions */}
      {mode === 'select' && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Tap dates to toggle availability
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  daysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    paddingVertical: 8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 8,
    color: '#6B7280',
    position: 'absolute',
    bottom: 2,
  },
  statusIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#6B7280',
  },
  instructions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  instructionText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default AvailabilityCalendar;
