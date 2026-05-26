import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, View, YStack } from 'tamagui';
import { useRobotVoice } from '../../hooks/useRobotVoice';

export default function WelcomeScreen() {
  const { speak } = useRobotVoice();
  const router = useRouter();

  useEffect(() => {
    // Automatically speak khi load màn hình
    speak('Chào mừng quý khách đến với Smart Market Bót ! Tôi có thể giúp gì cho bạn?');
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View flex={1} backgroundColor="white" justifyContent="center" alignItems="center" position="relative">

        {/* Nền Gradient mờ ảo */}
        <View position="absolute" top={-100} left={-100} width={400} height={400} borderRadius={200} backgroundColor="#00A550" opacity={0.03} />
        <View position="absolute" bottom={-150} right={-100} width={500} height={500} borderRadius={250} backgroundColor="#00A550" opacity={0.04} />

        {/* Tên thương hiệu đặt sát góc trên bên trái */}
        <YStack position="absolute" top={-7} left={20} alignItems="flex-start" gap={0}>
          <Text
            color="$brandGreen"
            fontSize={36}
            fontWeight="900"
            fontFamily="$heading"
            letterSpacing={1}
          >
            SmartMarketBot
          </Text>
          <Text
            color="$textSecondary"
            fontSize={12}
            fontWeight="bold"
            letterSpacing={2.5}
            opacity={0.8}
            marginTop={-2}
          >
            ROBOTIC SHOPPING ASSISTANT
          </Text>
        </YStack>

        {/* Robot GIF dạng hình tròn tinh xảo nằm chính giữa màn hình */}
        <View
          width={280}
          height={280}
          borderRadius={140}
          overflow="hidden"
          backgroundColor="#f6fcf8"
          borderWidth={1}
          borderColor="rgba(0,165,80,0.1)"
          style={{
            shadowColor: '#00A550',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.08,
            shadowRadius: 20,
            elevation: 4,
          }}
          justifyContent="center"
          alignItems="center"
        >
          <Image
            source={{ uri: "https://media.giphy.com/media/3og0IUzdgwVczU67eg/giphy.gif" }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="none"
          />
        </View>

        {/* Nút Bắt đầu đặt sát góc dưới bên phải */}
        <View position="absolute" bottom={30} right={30} zIndex={10}>
          <Button
            size="$5"
            backgroundColor="$brandGreen"
            color="white"
            borderRadius={30}
            paddingHorizontal="$6"
            pressStyle={{ scale: 0.95, opacity: 0.8 }}
            iconAfter={<ArrowRight size={20} color="white" />}
            onPress={() => {
              // Phát tiếng và chuyển trang
              speak('Tuyệt vời! Chúng ta bắt đầu thôi.');
              router.push('/role-selection');
            }}
            shadowColor="black"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.3}
            shadowRadius={5}
            elevation={5}
          >
            <Text color="white" fontWeight="bold" fontSize={18} lineHeight={24}>
              Bắt đầu ngay
            </Text>
          </Button>
        </View>

      </View>
    </SafeAreaView>
  );
}
