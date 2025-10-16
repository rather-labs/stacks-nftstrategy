'use client';

import NextLink from 'next/link';
import {
  Box,
  Button,
  Container,
  Divider,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  HStack,
  Icon,
  Link,
} from '@chakra-ui/react';
import { ArrowForwardIcon, RepeatIcon, LockIcon, StarIcon } from '@chakra-ui/icons';

const features = [
  {
    title: 'Automated Floor Rotations',
    description:
      'Sweep the floor programmatically, relist at a premium, and auto-route sale proceeds back to the treasury—accruing STX without manual management.',
    icon: RepeatIcon,
  },
  {
    title: 'Fee-On-Transfer Yield',
    description:
      'Every marketplace or pool interaction returns 10% to the strategy treasury, compounding the next buy and accelerating the cycle.',
    icon: StarIcon,
  },
  {
    title: 'Non-Custodial Controls',
    description:
      'No off-chain servers. Contracts live entirely on Stacks. Execute from any wallet with built-in post-conditions for safety.',
    icon: LockIcon,
  },
];

const phases = [
  {
    title: 'Acquire the Floor',
    copy: 'The strategy treasury buys the lowest-priced NFT (e.g., Funny Dog collection) on Stacks.',
  },
  {
    title: 'Relist at a Premium',
    copy: 'The position is immediately relisted at a +10% markup to capture spread as the market clears.',
  },
  {
    title: 'Recycle and Burn',
    copy: 'When the relisted NFT sells, the STX flows through the pool, swaps to RATHER, and the purchased RATHER is burned—reducing supply while refueling the treasury.',
  },
];

const resources = [
  {
    label: 'Explore the Dashboard',
    href: '/strategy',
  },
  {
    label: 'View Marketplace Listings',
    href: '/marketplace',
  },
  {
    label: 'Check Liquidity Pool',
    href: '/liquidity',
  },
];

export default function LandingPage() {
  return (
    <Box
      as="main"
      bgGradient="linear(to-b, white, purple.50)"
      minH="100vh"
      py={{ base: 12, md: 20 }}
    >
      <Container maxW="6xl">
        <Stack spacing={{ base: 12, md: 16 }}>
          <Stack spacing={6} textAlign="center" align="center">
            <Heading size={{ base: 'xl', md: '2xl' }} maxW="4xl">
              RATHER Strategy Protocol
            </Heading>
            <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.600" maxW="3xl">
              A looping NFT accumulation engine built on Stacks. Automate floor sweeps. Capture the
              spread. Burn the supply. Non-custodial, fully on-chain, and built for composability.
            </Text>
            <HStack spacing={4} flexWrap="wrap" justify="center">
              <Button
                as={NextLink}
                href="/strategy"
                size="lg"
                colorScheme="purple"
                rightIcon={<ArrowForwardIcon />}
              >
                Launch Dashboard
              </Button>
              <Button as={NextLink} href="/marketplace" size="lg" variant="outline">
                Browse Marketplace
              </Button>
            </HStack>
          </Stack>

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            {features.map((feature) => (
              <Stack
                key={feature.title}
                spacing={4}
                p={6}
                borderRadius="lg"
                borderWidth="1px"
                borderColor="purple.100"
                bg="white"
                boxShadow="sm"
                h="100%"
              >
                <Icon as={feature.icon} boxSize={10} color="purple.500" />
                <Heading size="md">{feature.title}</Heading>
                <Text color="gray.600">{feature.description}</Text>
              </Stack>
            ))}
          </SimpleGrid>

          <Stack spacing={6} p={{ base: 6, md: 10 }} borderRadius="2xl" bg="white" boxShadow="md">
            <Heading size="lg" textAlign={{ base: 'left', md: 'center' }}>
              How the flywheel spins
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
              {phases.map((phase, index) => (
                <Stack key={phase.title} spacing={3}>
                  <Text fontWeight="semibold" color="purple.500">
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Heading size="md">{phase.title}</Heading>
                  <Text color="gray.600">{phase.copy}</Text>
                </Stack>
              ))}
            </SimpleGrid>
          </Stack>

          <Stack spacing={4} align="center">
            <Heading size="md">Dive deeper</Heading>
            <Text color="gray.600" textAlign="center" maxW="2xl">
              Whether you want to interact with the contracts, monitor liquidity, or browse active
              listings, everything lives inside the app. Start with the dashboard and explore from
              there.
            </Text>
            <HStack spacing={6} flexWrap="wrap" justify="center">
              {resources.map((resource) => (
                <Link
                  key={resource.label}
                  as={NextLink}
                  href={resource.href}
                  fontWeight="semibold"
                  color="purple.600"
                  _hover={{ textDecoration: 'underline' }}
                >
                  {resource.label}
                </Link>
              ))}
            </HStack>
          </Stack>

          <Divider />

          <Stack
            spacing={4}
            align="center"
            textAlign="center"
            p={{ base: 6, md: 10 }}
            borderRadius="2xl"
            bg="purple.600"
            color="white"
          >
            <Heading size="lg">Ready to automate your NFT treasury?</Heading>
            <Text maxW="2xl">
              Connect a devnet wallet, monitor treasury health, and trigger buys or burns in a few
              clicks. The strategy contract handles the rest.
            </Text>
            <Button
              as={NextLink}
              href="/strategy"
              size="lg"
              colorScheme="blackAlpha"
              variant="solid"
              rightIcon={<ArrowForwardIcon />}
            >
              Open the Strategy Dashboard
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
