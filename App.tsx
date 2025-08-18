import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import './global.css';

export default function App() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Text className="text-text text-xl font-semibold">Signal Garden</Text>
      <Text className="text-text/80 text-base mt-2">
        Ready for development!
      </Text>
      <StatusBar style="light" />
    </View>
  );
}
