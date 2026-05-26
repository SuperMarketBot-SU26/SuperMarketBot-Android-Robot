import { createTamagui } from 'tamagui'
import { config } from '@tamagui/config/v3'

const tamaguiConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: {
      ...config.themes.light,
      brandGreen: '#006945',
      brandGreenLight: '#e6f0eb',
      surface: '#ffffff',
      textPrimary: '#1a1c1c',
      textSecondary: '#514347'
    }
  }
})

export type AppConfig = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig
