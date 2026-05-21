import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { ExploreScreen } from './src/screens/ExploreScreen';
import { PostScreen } from './src/screens/PostScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { colors, font } from './src/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingBottom: 6,
            paddingTop: 6,
            height: 60,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: {
            fontSize: font.xs,
            fontWeight: '700',
          },
          tabBarIcon: ({ color, size, focused }) => {
            const icons: Record<string, { active: string; inactive: string }> = {
              Explore: { active: 'compass', inactive: 'compass-outline' },
              Post: { active: 'wifi', inactive: 'wifi-outline' },
              Profile: { active: 'person', inactive: 'person-outline' },
            };
            const name = icons[route.name];
            return (
              <Ionicons
                name={(focused ? name.active : name.inactive) as any}
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tab.Screen name="Explore" component={ExploreScreen} />
        <Tab.Screen name="Post" component={PostScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
