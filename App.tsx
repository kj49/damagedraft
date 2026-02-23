import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import ReportEditorScreen from './src/screens/ReportEditorScreen';
import IncompleteReportsScreen from './src/screens/IncompleteReportsScreen';
import CompletedReportsScreen from './src/screens/CompletedReportsScreen';
import OptionsScreen from './src/screens/OptionsScreen';
import DraftSuccessScreen from './src/screens/DraftSuccessScreen';
import VinDecoderScreen from './src/screens/VinDecoderScreen';
import { ThemeProvider, useThemeContext } from './src/lib/theme';
import { RootStackParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { theme } = useThemeContext();
  const baseTheme = theme.isDark ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      theme={{
        ...baseTheme,
        colors: {
          ...baseTheme.colors,
          background: theme.background,
          card: theme.surface,
          text: theme.text,
          border: theme.border,
          primary: theme.primary,
        },
      }}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'DamageDraft' }} />
        <Stack.Screen name="ReportEditor" component={ReportEditorScreen} options={{ title: 'Report Editor' }} />
        <Stack.Screen name="IncompleteReports" component={IncompleteReportsScreen} options={{ title: 'Incomplete Reports' }} />
        <Stack.Screen name="CompletedReports" component={CompletedReportsScreen} options={{ title: 'Completed Reports' }} />
        <Stack.Screen name="VinDecoder" component={VinDecoderScreen} options={{ title: 'VIN Decoder' }} />
        <Stack.Screen name="Options" component={OptionsScreen} options={{ title: 'Options' }} />
        <Stack.Screen name="DraftSuccess" component={DraftSuccessScreen} options={{ title: 'Draft Opened' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
