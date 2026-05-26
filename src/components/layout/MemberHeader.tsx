import React, { useState } from 'react';
import { View, Text, XStack, YStack, Avatar, Progress, Button } from 'tamagui';
import { Cloud, Trash2, MapPin, User, Settings, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

export function MemberHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    setMenuOpen(false);
    router.replace('/role-selection' as any);
  };

  return (
    <XStack
      width="100%"
      justifyContent="space-between"
      alignItems="center"
      paddingHorizontal="$6"
      paddingVertical="$4"
      backgroundColor="white"
      borderBottomWidth={1}
      borderBottomColor="#f0f0f0"
      zIndex={100}
    >
      {/* LEFT: Logo & Weather */}
      <XStack alignItems="center" gap="$6">
        <Text fontSize={22} fontWeight="900" color="#00A550">
          SmartMarketBot
        </Text>
      </XStack>

      {/* RIGHT: Budget, Icons, Profile */}
      <XStack alignItems="center" gap="$6">

        {/* Budget */}
        <XStack alignItems="center" gap="$3" backgroundColor="#f2fcf5" paddingHorizontal="$4" paddingVertical="$2" borderRadius={20}>
          <YStack gap="$1" width={120}>
            <Text fontSize={10} fontWeight="bold" color="#00A550">NGÂN SÁCH</Text>
            <Progress size="$1" value={45} backgroundColor="#e0f2e9">
              <Progress.Indicator backgroundColor="#00A550" />
            </Progress>
          </YStack>
          <Text fontSize={12} fontWeight="bold" color="#00A550">450k/1000k</Text>
        </XStack>

        {/* Action Icons
        <XStack gap="$4" alignItems="center">
          <Trash2 size={20} color="#333" />
          <MapPin size={20} color="#333" />
        </XStack> */}

        {/* Divider */}
        <View width={1} height={24} backgroundColor="#e0e0e0" />

        {/* Profile (Clickable with Dropdown) */}
        <View position="relative" zIndex={100}>
          <XStack
            alignItems="center"
            gap="$3"
            onPress={() => setMenuOpen(!menuOpen)}
            cursor="pointer"
          >
            <YStack alignItems="flex-end">
              <Text fontSize={14} fontWeight="bold" color="$textPrimary">Duy Nguyễn</Text>
              <Text fontSize={10} fontWeight="bold" color="#00A550">PREMIUM MEMBER</Text>
            </YStack>
            <Avatar circular size="$3" style={{ borderWidth: 2, borderColor: menuOpen ? '#00A550' : 'transparent' }}>
              <Avatar.Image src="https://i.pravatar.cc/150?u=duy" />
              <Avatar.Fallback backgroundColor="#00A550" />
            </Avatar>
          </XStack>

          {/* Dropdown Menu */}
          {menuOpen && (
            <Animated.View
              entering={FadeInUp.duration(300).springify()}
              exiting={FadeOutUp.duration(200)}
              style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                width: 200,
                backgroundColor: 'white',
                borderRadius: 12,
                shadowColor: 'black',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 20,
                elevation: 5,
                borderWidth: 1,
                borderColor: '#f0f0f0',
                overflow: 'hidden'
              }}
            >
              <Button
                justifyContent="flex-start"
                backgroundColor="transparent"
                borderRadius={0}
                icon={<User size={18} color="#555" />}
                onPress={() => setMenuOpen(false)}
              >
                <Text color="#333" fontWeight="500">Hồ sơ cá nhân</Text>
              </Button>

              <Button
                justifyContent="flex-start"
                backgroundColor="transparent"
                borderRadius={0}
                icon={<Settings size={18} color="#555" />}
                onPress={() => setMenuOpen(false)}
              >
                <Text color="#333" fontWeight="500">Cài đặt</Text>
              </Button>

              <View width="100%" height={1} backgroundColor="#f0f0f0" />

              <Button
                justifyContent="flex-start"
                backgroundColor="#fff1f2"
                borderRadius={0}
                icon={<LogOut size={18} color="#e11d48" />}
                pressStyle={{ backgroundColor: '#ffe4e6' }}
                onPress={handleLogout}
              >
                <Text color="#e11d48" fontWeight="bold">Đăng xuất</Text>
              </Button>
            </Animated.View>
          )}
        </View>

      </XStack>
    </XStack>
  );
}
