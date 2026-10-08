import { ScrollView, StyleSheet, Text, View } from 'react-native';
import CameraPrototype from './src/components/CameraPrototype';

export default function App() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Gymbro</Text>
      <Text style={styles.subtitle}>Catat setiap repetisi. Lihat progres latihanmu.</Text>
      <CameraPrototype/>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#f4f7fb', alignItems: 'center', padding: 24, gap: 20 },
  title: { fontSize: 48, fontWeight: '800', color: '#15233d' },
  subtitle: { marginTop: 12, fontSize: 18, color: '#63708a', textAlign: 'center' },
});
