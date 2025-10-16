'use client';

import {
  Box,
  Container,
  Flex,
  Link,
  Stack,
  Text,
  Image,
  HStack,
  Divider,
  Icon,
  useColorMode,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaGithub, FaTwitter, FaLinkedin, FaGlobe } from 'react-icons/fa';

export const Footer = () => {
  const { colorMode } = useColorMode();
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    {
      label: 'Website',
      href: 'https://ratherlabs.com',
      icon: FaGlobe,
    },
    {
      label: 'GitHub',
      href: 'https://github.com/rather-labs',
      icon: FaGithub,
    },
    {
      label: 'X (Twitter)',
      href: 'https://x.com/rather_labs',
      icon: FaTwitter,
    },
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/company/ratherlabs/',
      icon: FaLinkedin,
    },
  ];

  const projectLinks = [
    { label: 'Dashboard', href: '/strategy' },
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Liquidity Pool', href: '/liquidity' },
  ];

  const resourceLinks = [
    { label: 'Documentation', href: 'https://docs.ratherlabs.com', external: true },
    { label: 'Stacks Explorer', href: 'https://explorer.hiro.so', external: true },
    { label: 'RATHER Token', href: 'https://ratherlabs.com/rather-token', external: true },
  ];

  return (
    <Box as="footer" bg="bg.surface" borderTop="1px" borderColor="border.default" mt="auto">
      <Container maxW="container.xl" py={12}>
        <Stack spacing={8}>
          {/* Main Footer Content */}
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align={{ base: 'flex-start', md: 'flex-start' }}
            gap={8}
          >
            {/* Brand Section */}
            <Stack spacing={4} maxW={{ base: '100%', md: '400px' }}>
              <Link href="/" _hover={{ opacity: 0.8 }}>
                <Image
                  src={
                    colorMode === 'dark' ? '/images/rather-white.svg' : '/images/rather-dark.svg'
                  }
                  alt="RATHER Labs"
                  height="35px"
                  width="auto"
                />
              </Link>
              <Text color="text.secondary" fontSize="sm">
                An automated NFT accumulation strategy protocol built on Stacks. Non-custodial,
                fully on-chain, and built for composability.
              </Text>
              <HStack spacing={4} pt={2}>
                {socialLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    isExternal
                    _hover={{ color: 'brand.primary', transform: 'translateY(-2px)' }}
                    transition="all 0.2s"
                    aria-label={link.label}
                  >
                    <Icon as={link.icon} boxSize={5} />
                  </Link>
                ))}
              </HStack>
            </Stack>

            {/* Navigation Links */}
            <Stack spacing={4} minW="150px">
              <Text fontWeight="bold" color="text.primary">
                Protocol
              </Text>
              <Stack spacing={2}>
                {projectLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    color="text.secondary"
                    fontSize="sm"
                    _hover={{ color: 'brand.primary' }}
                    transition="color 0.2s"
                  >
                    {link.label}
                  </Link>
                ))}
              </Stack>
            </Stack>

            {/* Rather Labs Info */}
            <Stack spacing={4} minW="200px">
              <Text fontWeight="bold" color="text.primary">
                Built by Rather Labs
              </Text>
              <Text color="text.secondary" fontSize="sm">
                Rather Labs builds the technology that powers Web3 innovation—enabling businesses to
                launch, scale, and lead across networks.
              </Text>
              <Link
                href="https://ratherlabs.com/about"
                isExternal
                color="brand.primary"
                fontSize="sm"
                fontWeight="semibold"
                _hover={{ textDecoration: 'underline' }}
              >
                Learn more about us →
              </Link>
            </Stack>
          </Flex>

          <Divider />

          {/* Bottom Bar */}
          <Flex
            direction={{ base: 'column', md: 'row' }}
            justify="space-between"
            align="center"
            gap={4}
          >
            <Text color="text.tertiary" fontSize="sm">
              © {currentYear} Rather Labs. All rights reserved.
            </Text>
            <HStack spacing={6} fontSize="sm">
              <Link
                href="https://ratherlabs.com/privacy-policy"
                isExternal
                color="text.tertiary"
                _hover={{ color: 'text.primary' }}
              >
                Privacy Policy
              </Link>
            </HStack>
          </Flex>
        </Stack>
      </Container>
    </Box>
  );
};
