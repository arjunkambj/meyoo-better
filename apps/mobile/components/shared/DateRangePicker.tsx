import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Card, Divider } from 'heroui-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useDateRange,
  formatDateRange,
  DATE_PRESETS,
  type DateRange,
} from '@/store/dateRangeStore';

interface DateRangePickerProps {
  onClose?: () => void;
}

export function DateRangePicker({ onClose }: DateRangePickerProps) {
  const { dateRange, setDateRange, setPreset } = useDateRange();
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [customStart, setCustomStart] = useState(new Date(dateRange.start));
  const [customEnd, setCustomEnd] = useState(new Date(dateRange.end));

  const handlePresetSelect = useCallback(
    (preset: string) => {
      setPreset(preset);
      onClose?.();
    },
    [setPreset, onClose]
  );

  const handleCustomDateChange = useCallback(() => {
    const newRange: DateRange = {
      start: customStart.toISOString().split('T')[0],
      end: customEnd.toISOString().split('T')[0],
      preset: undefined,
    };
    setDateRange(newRange);
    onClose?.();
  }, [customStart, customEnd, setDateRange, onClose]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-default-200">
        <Text className="text-lg font-semibold text-foreground">Select Date Range</Text>
        <TouchableOpacity onPress={onClose} className="p-2">
          <Ionicons name="close" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Preset Options */}
        <View className="px-4 py-4">
          <Text className="text-sm font-semibold text-default-600 mb-3">Quick Select</Text>
          <View className="gap-2">
            {DATE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.key}
                onPress={() => handlePresetSelect(preset.key)}
                activeOpacity={0.7}
              >
                <Card
                  className={
                    dateRange.preset === preset.key
                      ? 'border-primary bg-primary/5'
                      : 'border-default-200'
                  }
                >
                  <Card.Body className="py-3">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={
                          dateRange.preset === preset.key
                            ? 'text-primary font-semibold'
                            : 'text-foreground'
                        }
                      >
                        {preset.label}
                      </Text>
                      {dateRange.preset === preset.key && (
                        <Ionicons name="checkmark-circle" size={20} color="#6366f1" />
                      )}
                    </View>
                  </Card.Body>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Divider className="my-4" />

        {/* Custom Date Range */}
        <View className="px-4 pb-4">
          <Text className="text-sm font-semibold text-default-600 mb-3">Custom Range</Text>

          <View className="gap-3">
            <TouchableOpacity
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <Card>
                <Card.Body className="py-3">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-xs text-default-500 mb-1">Start Date</Text>
                      <Text className="text-base font-medium text-foreground">
                        {formatDate(customStart)}
                      </Text>
                    </View>
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                  </View>
                </Card.Body>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.7}
            >
              <Card>
                <Card.Body className="py-3">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-xs text-default-500 mb-1">End Date</Text>
                      <Text className="text-base font-medium text-foreground">
                        {formatDate(customEnd)}
                      </Text>
                    </View>
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                  </View>
                </Card.Body>
              </Card>
            </TouchableOpacity>

            <Button
              variant="primary"
              onPress={handleCustomDateChange}
              className="mt-2"
            >
              <Button.LabelContent>Apply Custom Range</Button.LabelContent>
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* Date Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={customStart}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setCustomStart(selectedDate);
              // Ensure end date is not before start date
              if (selectedDate > customEnd) {
                setCustomEnd(selectedDate);
              }
            }
          }}
          maximumDate={new Date()}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={customEnd}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setCustomEnd(selectedDate);
            }
          }}
          minimumDate={customStart}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
}

// Button to trigger the date picker
export function DateRangePickerButton() {
  const [showPicker, setShowPicker] = useState(false);
  const { dateRange } = useDateRange();

  const displayText = useMemo(() => {
    if (dateRange.preset) {
      const preset = DATE_PRESETS.find((p) => p.key === dateRange.preset);
      return preset?.label || formatDateRange(dateRange);
    }
    return formatDateRange(dateRange);
  }, [dateRange]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        className="bg-surface-2 rounded-xl px-4 py-2.5 flex-row items-center gap-2"
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color="#6366f1" />
        <Text className="text-sm font-medium text-foreground">{displayText}</Text>
        <Ionicons name="chevron-down" size={16} color="#666" />
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <SafeAreaView className="flex-1 bg-background">
          <DateRangePicker onClose={() => setShowPicker(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}