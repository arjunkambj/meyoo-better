import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";

import { KpiCard } from "@/components/analytics/KpiCard";
import { SectionCard } from "@/components/common/SectionCard";
import { SectionHeader } from "@/components/common/SectionHeader";
import { formatCurrency } from "@/libs/currency";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const channelOptions = [
  { id: "web", label: "Web" },
  { id: "mobile", label: "Mobile" },
];

export default function AdsScreen() {
  const [channel, setChannel] = useState<(typeof channelOptions)[number]["id"]>("web");
  const [showPicker, setShowPicker] = useState(false);
  const [range, setRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [activePicker, setActivePicker] = useState<"start" | "end">("start");
  const { primaryCurrency } = useCurrentUser();

  const togglePicker = (picker: "start" | "end") => {
    setActivePicker(picker);
    setShowPicker(true);
  };

  const onChangeDate = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) {
      setShowPicker(false);
      return;
    }

    setRange((prev) => ({
      ...prev,
      [activePicker]: selected,
    }));

    if (Platform.OS !== "ios") {
      setShowPicker(false);
    }
  };

  const formattedRange = `${range.start.toDateString()} → ${range.end.toDateString()}`;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 96 }}>
        <View className="mt-8 gap-6">
          <SectionHeader
            title="Ads performance"
            subtitle="Compare spend and returns across web and mobile campaigns."
          />

          <SectionCard title="Channel focus" description="Switch between platform views.">
            <View className="flex-row rounded-full bg-background/60 p-1">
              {channelOptions.map((option) => {
                const isActive = option.id === channel;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setChannel(option.id)}
                    className={`flex-1 rounded-full px-4 py-2 ${
                      isActive ? "bg-primary" : "bg-transparent"
                    }`}
                  >
                    <Text
                      className={`text-center text-sm font-medium ${
                        isActive ? "text-white" : "text-muted-foreground"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          <SectionCard
            title="Date range"
            description="Tailor the period for campaign analytics."
            spacing="tight"
          >
            <Pressable
              onPress={() => togglePicker("start")}
              className="rounded-3xl bg-background/70 px-4 py-3"
            >
              <Text className="text-xs text-muted-foreground">From</Text>
              <Text className="text-base text-foreground">
                {range.start.toDateString()}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => togglePicker("end")}
              className="rounded-3xl bg-background/70 px-4 py-3"
            >
              <Text className="text-xs text-muted-foreground">To</Text>
              <Text className="text-base text-foreground">{range.end.toDateString()}</Text>
            </Pressable>
            <Text className="text-sm font-medium text-muted-foreground">
              {formattedRange}
            </Text>
          </SectionCard>

          <View className="flex-row flex-wrap justify-between gap-4">
            <View className="w-[48%] min-w-[150px]">
              <KpiCard
                label="Ad Spend"
                value={formatCurrency(0, primaryCurrency)}
                delta={null}
              />
            </View>
            <View className="w-[48%] min-w-[150px]">
              <KpiCard label="ROAS" value="0.00" delta={null} />
            </View>
            <View className="w-[48%] min-w-[150px]">
              <KpiCard label="Conversions" value="0" delta={null} />
            </View>
            <View className="w-[48%] min-w-[150px]">
              <KpiCard
                label="CPA"
                value={formatCurrency(0, primaryCurrency)}
                delta={null}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showPicker} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-3xl bg-background p-6">
            <Text className="mb-2 text-base font-semibold text-foreground">
              Select {activePicker === "start" ? "start" : "end"} date
            </Text>
            <DateTimePicker value={range[activePicker]} mode="date" onChange={onChangeDate} />
            {Platform.OS === "ios" ? (
              <View className="mt-4 flex-row justify-end gap-4">
                <Pressable onPress={() => setShowPicker(false)}>
                  <Text className="text-base font-medium text-muted-foreground">
                    Close
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
