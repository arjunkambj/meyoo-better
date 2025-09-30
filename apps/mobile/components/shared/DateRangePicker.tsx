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
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border/40">
        <Text className="text-xl font-bold text-foreground">Select Date Range</Text>
        <TouchableOpacity onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-surface-2">
          <Ionicons name="close" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Preset Options */}
        <View className="px-6 py-5">
          <Text className="text-sm font-bold uppercase tracking-wider text-default-500 mb-4">Quick Select</Text>
          <View className="gap-2.5">
            {DATE_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.key}
                onPress={() => handlePresetSelect(preset.key)}
                activeOpacity={0.7}
              >
                <Card
                  surfaceVariant="2"
                  className={`rounded-2xl ${
                    dateRange.preset === preset.key
                      ? 'border-2 border-primary'
                      : 'border border-border/50'
                  }`}
                >
                  <Card.Body className="px-4 py-4">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-base font-semibold ${
                          dateRange.preset === preset.key
                            ? 'text-primary'
                            : 'text-foreground'
                        }`}
                      >
                        {preset.label}
                      </Text>
                      {dateRange.preset === preset.key && (
                        <View className="h-6 w-6 rounded-full bg-primary items-center justify-center">
                          <Ionicons name="checkmark" size={16} color="#ffffff" />
                        </View>
                      )}
                    </View>
                  </Card.Body>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Divider className="mx-6 my-2 bg-border/60" />

        {/* Custom Date Range */}
        <View className="px-6 py-5">
          <Text className="text-sm font-bold uppercase tracking-wider text-default-500 mb-4">Custom Range</Text>

          <View className="gap-3">
            <TouchableOpacity
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="px-4 py-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-xs font-bold uppercase tracking-wider text-default-500 mb-1.5">Start Date</Text>
                      <Text className="text-base font-semibold text-foreground">
                        {formatDate(customStart)}
                      </Text>
                    </View>
                    <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center">
                      <Ionicons name="calendar" size={20} color="#6366f1" />
                    </View>
                  </View>
                </Card.Body>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.7}
            >
              <Card surfaceVariant="2" className="rounded-2xl border border-border/50">
                <Card.Body className="px-4 py-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-xs font-bold uppercase tracking-wider text-default-500 mb-1.5">End Date</Text>
                      <Text className="text-base font-semibold text-foreground">
                        {formatDate(customEnd)}
                      </Text>
                    </View>
                    <View className="h-10 w-10 rounded-xl bg-primary/10 items-center justify-center">
                      <Ionicons name="calendar" size={20} color="#6366f1" />
                    </View>
                  </View>
                </Card.Body>
              </Card>
            </TouchableOpacity>

            <Button
              variant="primary"
              size="lg"
              onPress={handleCustomDateChange}
              className="mt-3 h-14 rounded-2xl"
            >
              <Button.StartContent>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
              </Button.StartContent>
              <Button.LabelContent classNames={{ text: 'font-bold' }}>Apply Custom Range</Button.LabelContent>
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
        className="bg-primary/10 rounded-xl px-3.5 py-2.5 flex-row items-center gap-2 border border-primary/20"
        activeOpacity={0.7}
      >
        <Ionicons name="calendar" size={18} color="#6366f1" />
        <Text className="text-sm font-semibold text-primary">{displayText}</Text>
        <Ionicons name="chevron-down" size={16} color="#6366f1" />
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPicker(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
          <DateRangePicker onClose={() => setShowPicker(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}