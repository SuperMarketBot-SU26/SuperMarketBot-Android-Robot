import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button, Input, Text, View, YStack, XStack } from 'tamagui';
import { Fingerprint, LogIn, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loginEmail } from '../../services/AuthService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useRobotVoice } from '../../hooks/useRobotVoice';

export default function RobotLoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setSession } = useRobotAuth();
  const { speak } = useRobotVoice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const params = useLocalSearchParams<{ returnUrl?: string }>();

  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập email và mật khẩu.');
    setBusy(true);
    try {
      const data = await loginEmail(email.trim(), password);
      const token = data.accessToken;
      if (!token) throw new Error('Server không trả về access token');
      setSession(token, {
        memberId: data.member?.memberId || data.userId || email,
        fullName: data.member?.fullName || data.fullName || email,
        email: data.member?.email || data.email || email,
        membershipLevel: data.member?.membershipLevel || null,
        shoppingBudget: data.member?.shoppingBudget,
        avatarUrl: data.member?.avatarUrl,
      });
      speak(`Chào mừng ${data.member?.fullName || data.fullName || 'bạn'} trở lại.`);
      if (params.returnUrl) {
        router.replace(params.returnUrl as any);
      } else {
        router.replace('/member-home' as any);
      }
    } catch (e: any) {
      Alert.alert('Đăng nhập thất bại', e?.message || 'Không thể kết nối máy chủ.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f4faf6' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$4" width="100%" maxWidth={400} alignSelf="center">
          {/* Top back button */}
          <XStack justifyContent="flex-start">
            <Button
              circular
              size="$3"
              backgroundColor="white"
              borderWidth={1}
              borderColor="#e2e8f0"
              icon={<ArrowLeft size={18} color="#005b2b" />}
              onPress={() => router.back()}
            />
          </XStack>

          <YStack gap="$2" alignItems="center" marginBottom="$2">
            <Text fontSize={23} fontWeight="900" color="#005b2b" textAlign="center">
              Đăng nhập thành viên
            </Text>
            <Text fontSize={13} color="#64748b" textAlign="center" lineHeight={18} paddingHorizontal="$2">
              Đăng nhập để tích điểm, nhận ưu đãi độc quyền và gợi ý mua sắm thông minh
            </Text>
          </YStack>

          <Input
            value={email}
            onChangeText={setEmail}
            placeholder="Email tài khoản"
            keyboardType="email-address"
            autoCapitalize="none"
            size="$4.5"
            backgroundColor="white"
            borderColor="#e2e8f0"
            borderRadius={14}
          />
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Mật khẩu"
            secureTextEntry
            size="$4.5"
            backgroundColor="white"
            borderColor="#e2e8f0"
            borderRadius={14}
          />

          <Button
            size="$4.5"
            backgroundColor="#00A550"
            color="white"
            borderRadius={14}
            icon={<LogIn size={18} color="white" />}
            onPress={submit}
            disabled={busy}
            pressStyle={{ opacity: 0.85 }}
          >
            <Text color="white" fontWeight="800" fontSize={15}>
              {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Text>
          </Button>

          <XStack alignItems="center" justifyContent="center" gap="$2" marginTop="$1">
            <Text color="#64748b" fontSize={13}>Hoặc</Text>
            <Button
              chromeless
              onPress={() => router.push('/face-scan' as any)}
              icon={<Fingerprint size={18} color="#00A550" />}
              paddingHorizontal="$2"
            >
              <Text color="#00A550" fontWeight="800" fontSize={13}>Quét Face ID</Text>
            </Button>
          </XStack>

          <Button
            chromeless
            onPress={() => router.replace('/guest-home' as any)}
            marginTop="$1"
          >
            <Text color="#64748b" fontSize={13} fontWeight="600">Tiếp tục với tư cách khách</Text>
          </Button>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
