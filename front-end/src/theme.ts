import { extendTheme, type ThemeConfig, type StyleFunctionProps } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  colors: {
    // Custom brand colors - purple is primary
    brand: {
      50: '#F5F3FF',
      100: '#EDE9FE',
      200: '#DDD6FE',
      300: '#C4B5FD',
      400: '#A78BFA',
      500: '#8B5CF6',
      600: '#7C3AED',
      700: '#6D28D9',
      800: '#5B21B6',
      900: '#4C1D95',
    },
  },
  semanticTokens: {
    colors: {
      // Background colors
      'bg.canvas': {
        default: 'white',
        _dark: 'gray.900',
      },
      'bg.surface': {
        default: 'white',
        _dark: 'gray.800',
      },
      'bg.subtle': {
        default: 'gray.50',
        _dark: 'gray.700',
      },
      'bg.muted': {
        default: 'gray.100',
        _dark: 'gray.600',
      },

      // Text colors
      'text.primary': {
        default: 'gray.900',
        _dark: 'white',
      },
      'text.secondary': {
        default: 'gray.600',
        _dark: 'gray.400',
      },
      'text.tertiary': {
        default: 'gray.500',
        _dark: 'gray.500',
      },

      // Border colors
      'border.default': {
        default: 'gray.200',
        _dark: 'gray.600',
      },
      'border.subtle': {
        default: 'gray.100',
        _dark: 'gray.700',
      },
      'border.strong': {
        default: 'gray.700',
        _dark: 'gray.400',
      },

      // Brand semantic colors
      'brand.primary': {
        default: 'purple.600',
        _dark: 'purple.400',
      },
      'brand.subtle': {
        default: 'purple.100',
        _dark: 'purple.800',
      },
      'brand.surface': {
        default: 'purple.50',
        _dark: 'purple.900',
      },

      // Link colors
      'link.primary': {
        default: 'blue.500',
        _dark: 'blue.300',
      },

      // Price/accent colors (orange)
      'accent.primary': {
        default: 'orange.500',
        _dark: 'orange.300',
      },
    },
  },
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'white',
        color: props.colorMode === 'dark' ? 'white' : 'gray.900',
      },
    }),
  },
});

export default theme;
