import { Text, View } from "react-native";
import { Button } from "heroui-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text className="text-3xl">Meyoo From Meyoo</Text>
      <Text className="">Meyoo From Meyoo</Text>
      <Button onPress={() => console.log("Pressed!")}>Get Started</Button>
    </View>
  );
}
