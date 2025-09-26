import { Text, View, ScrollView } from "react-native";
import { Button } from "heroui-native";

export default function setting() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex items-center justify-center min-h-dvh gap-5">
        <Text className="text-3xl font-bold">Setting</Text>
        <Button className="bg-red-500 px-6">Button</Button>
      </View>
    </ScrollView>
  );
}
