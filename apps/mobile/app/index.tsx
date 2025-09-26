import { Text, View, ScrollView } from "react-native";
import { Button } from "heroui-native";

export default function Index() {
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 40,
          gap: 16,
        }}
      >
        <Text className="text-3xl font-bold mb-4">HeroUI Native Colors</Text>
        <Text className="text-xl font-semibold mt-4">Solid Variants</Text>
        <Button className="bg-red-500 px-6">Button</Button>
      </View>
    </ScrollView>
  );
}
