import { View, ScrollView } from "react-native";
import { Button } from "heroui-native";

export default function Index() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex items-center justify-center min-h-dvh gap-5">
        <Button className="bg-red-500 px-6">Continue With Google</Button>
      </View>
    </ScrollView>
  );
}
