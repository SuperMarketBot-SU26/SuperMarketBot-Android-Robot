import React, { useState, useEffect } from 'react';
import { View, Text, XStack, YStack, Avatar, Progress, Button } from 'tamagui';
import { Cloud, Trash2, MapPin, User, Settings, LogOut, ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { CartService } from '../../services/CartService';
import { MemberService } from '../../services/MemberService';

export function MemberHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { member, token, clearSession } = useRobotAuth();
  
  const [currentSpending, setCurrentSpending] = useState(0);
  const [actualBudget, setActualBudget] = useState<number | null>(member?.shoppingBudget || null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(member?.avatarUrl || null);

  useEffect(() => {
    let mounted = true;
    
    const fetchCart = () => {
      if (token) {
        CartService.getCart(token).then((res) => {
          if (mounted && res) {
            setCurrentSpending(res.totalPrice || 0);
          }
        }).catch(err => console.log('Cart fetch error in header:', err));
      }
    };

    const fetchProfile = async () => {
      if (token) {
        const profile = await MemberService.getProfile(token);
        if (mounted && profile) {
          if (profile.spendingLimit) setActualBudget(profile.spendingLimit);
          if (profile.avatarUrl) setAvatarUrl(profile.avatarUrl);
        }
      }
    };

    fetchProfile();

    fetchCart(); // Initial fetch
    const interval = setInterval(fetchCart, 3000); // Sync every 3 seconds

    return () => { 
      mounted = false; 
      clearInterval(interval);
    };
  }, [token]);

  const handleLogout = () => {
    setMenuOpen(false);
    clearSession();
    router.replace('/role-selection' as any);
  };

  // Removed formatCurrency to use standard toLocaleString('vi-VN')

  const progressValue = actualBudget ? Math.min((currentSpending / actualBudget) * 100, 100) : 0;
  const isOverBudget = actualBudget ? currentSpending > actualBudget : false;

  return (
    <YStack
      width="100%"
      paddingHorizontal="$4"
      paddingVertical="$4"
      backgroundColor="white"
      borderBottomWidth={1}
      borderBottomColor="#f0f0f0"
      zIndex={100}
      gap="$4"
    >
      {/* ROW 1: Logo & Profile */}
      <XStack justifyContent="space-between" alignItems="center">
        {/* LEFT: Logo */}
        <Text fontSize={22} fontWeight="900" color="#00A550">
          SmartMarketBot
        </Text>

        {/* RIGHT: Profile (Clickable with Dropdown) */}
        <View position="relative" zIndex={100}>
          <XStack
            alignItems="center"
            gap="$3"
            onPress={() => setMenuOpen(!menuOpen)}
            cursor="pointer"
          >
            <YStack alignItems="flex-end">
              <Text fontSize={14} fontWeight="bold" color="$textPrimary">{member?.fullName || 'Khách'}</Text>
              <Text fontSize={10} fontWeight="bold" color="#00A550">{member?.membershipLevel?.toUpperCase() || 'MEMBER'}</Text>
            </YStack>
            <Avatar circular size="$3" style={{ borderWidth: 2, borderColor: menuOpen ? '#00A550' : 'transparent' }}>
              <Avatar.Image src={avatarUrl ? (avatarUrl.startsWith('http') ? avatarUrl : `https://smb-api.duckdns.org${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`) : "https://i.pravatar.cc/150?u=robot"} />
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

      {/* ROW 2: Budget & Cart Button */}
      <XStack alignItems="center" gap="$3">
        {actualBudget ? (
          <XStack flex={1} alignItems="center" backgroundColor={isOverBudget ? "#fff1f2" : "#f2fcf5"} paddingHorizontal="$4" paddingVertical="$3" borderRadius={20} borderWidth={1} borderColor={isOverBudget ? "#ffe4e6" : "#e0f2e9"}>
            <YStack gap="$1.5" flex={1}>
              <YStack>
                <Text fontSize={10} fontWeight="900" color={isOverBudget ? "#e11d48" : "#005b2b"} letterSpacing={0.5}>
                  NGÂN SÁCH MUA SẮM
                </Text>
                <Text fontSize={14} fontWeight="bold" color={isOverBudget ? "#e11d48" : "#00A550"} marginTop="$1">
                  {currentSpending.toLocaleString('vi-VN')}đ / <Text color={isOverBudget ? "#be123c" : "#166534"}>{actualBudget.toLocaleString('vi-VN')}đ</Text>
                </Text>
              </YStack>
              <Progress size="$1.5" value={progressValue} backgroundColor={isOverBudget ? "#fecdd3" : "#d1fae5"} marginTop="$1">
                <Progress.Indicator backgroundColor={isOverBudget ? "#e11d48" : "#00A550"} />
              </Progress>
            </YStack>
          </XStack>
        ) : (
          <XStack flex={1} alignItems="center" backgroundColor="#f8fafc" paddingHorizontal="$4" paddingVertical="$3" borderRadius={20} borderWidth={1} borderColor="#e2e8f0">
            <YStack gap="$1.5" flex={1}>
              <YStack>
                <Text fontSize={11} fontWeight="bold" color="#64748b">
                  TỔNG THANH TOÁN
                </Text>
                <Text fontSize={15} fontWeight="900" color="#334155" marginTop="$1">
                  {currentSpending.toLocaleString('vi-VN')}đ
                </Text>
              </YStack>
            </YStack>
          </XStack>
        )}

        <Button
          size="$4"
          backgroundColor="#00A550"
          borderRadius={20}
          icon={<ShoppingCart size={20} color="white" />}
          onPress={() => router.push('/member-cart' as any)}
          pressStyle={{ scale: 0.95, backgroundColor: '#00823e' }}
          paddingHorizontal="$3"
        >
          <Text color="white" fontWeight="bold">Giỏ hàng</Text>
        </Button>
      </XStack>
    </YStack>
  );
}
