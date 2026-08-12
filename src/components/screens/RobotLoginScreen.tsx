import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Text, View, YStack, XStack } from 'tamagui';
import { Fingerprint, LogIn } from 'lucide-react-native';
import { loginEmail } from '../../services/AuthService';
import { useRobotAuth } from '../../context/RobotAuthContext';
import { useRobotVoice } from '../../hooks/useRobotVoice';

export default function RobotLoginScreen() {
  const router = useRouter();
  const { setSession } = useRobotAuth();
  const { speak } = useRobotVoice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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
      router.replace('/member-home' as any);
    } catch (e: any) {
      Alert.alert('Đăng nhập thất bại', e?.message || 'Không thể kết nối máy chủ.');
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <YStack flex={1} padding="$6" justifyContent="center" gap="$4" backgroundColor="#f4faf6">
        <YStack gap="$2" alignItems="center" marginBottom="$4">
          <Text fontSize={28} fontWeight="900" color="#005b2b">Đăng nhập thành viên</Text>
          <Text color="#64748b" textAlign="center">Đăng nhập để nhận ưu đãi và lưu lịch sử mua sắm</Text>
        </YStack>
        <Input value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" size="$5" backgroundColor="white" />
        <Input value={password} onChangeText={setPassword} placeholder="Mật khẩu" secureTextEntry size="$5" backgroundColor="white" />
        <Button size="$5" backgroundColor="#00A550" color="white" icon={<LogIn size={20} color="white" />} onPress={submit} disabled={busy}>
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
        <XStack alignItems="center" justifyContent="center" gap="$2">
          <Text color="#64748b">Hoặc</Text>
          <Button chromeless onPress={() => router.push('/face-scan' as any)} icon={<Fingerprint size={20} color="#00A550" />}>
            <Text color="#00A550" fontWeight="800">Quét Face ID</Text>
          </Button>
        </XStack>
        <Button chromeless onPress={() => router.replace('/guest-home' as any)}>
          <Text color="#64748b">Tiếp tục với tư cách khách</Text>
        </Button>
      </YStack>
    </KeyboardAvoidingView>
  );
}
