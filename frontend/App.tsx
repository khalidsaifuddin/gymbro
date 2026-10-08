import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Gymbro</Text>
      <Text style={styles.subtitle}>Catat setiap repetisi. Lihat progres latihanmu.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f4f7fb', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 48, fontWeight: '800', color: '#15233d' },
  subtitle: { marginTop: 12, fontSize: 18, color: '#63708a', textAlign: 'center' },
});
