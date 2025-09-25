import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to the Meyoo mobile app</Text>
      <Text style={styles.subtitle}>
        Edit <Text style={styles.code}>app/index.tsx</Text> to get started.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#475569',
  },
  code: {
    fontFamily: 'Courier',
    fontWeight: '600',
  },
});
