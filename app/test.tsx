import React from 'react';
import { View, Text } from 'react-native';

export default function TestPage() {
  return (
    <View style={{ padding: 20, backgroundColor: 'white', flex: 1 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Test Page Working!
      </Text>
      <Text style={{ fontSize: 16 }}>
        This is a simple test page to verify routing is working correctly.
      </Text>
      <Text style={{ fontSize: 14, marginTop: 20, color: 'gray' }}>
        If you can see this, the Expo Router web routing is functioning.
      </Text>
    </View>
  );
} 