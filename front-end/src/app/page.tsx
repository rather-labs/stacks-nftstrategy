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
import { motion } from 'framer-motion';

// Wrap Chakra components with motion for animations
const MotionBox = motion(Box);
const MotionStack = motion(Stack);
const MotionHeading = motion(Heading);
const MotionText = motion(Text);
const MotionHStack = motion(HStack);
const MotionSimpleGrid = motion(SimpleGrid);

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
    },
  },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: 'easeOut',
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const slideInFromLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.7,
      ease: 'easeOut',
    },
  },
};

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
      bgGradient="linear(to-b, bg.canvas, brand.surface)"
      minH="100vh"
      py={{ base: 12, md: 20 }}
    >
      <Container maxW="6xl">
        <Stack spacing={{ base: 12, md: 16 }}>
          {/* Hero Section */}
          <MotionStack
            spacing={6}
            textAlign="center"
            align="center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            <MotionHeading
              size={{ base: 'xl', md: '2xl' }}
              maxW="4xl"
              variants={fadeInUp}
            >
              RATHER Strategy Protocol
            </MotionHeading>
            <MotionText
              fontSize={{ base: 'md', md: 'lg' }}
              color="text.secondary"
              maxW="3xl"
              variants={fadeInUp}
            >
              A looping NFT accumulation engine built on Stacks. Automate floor sweeps. Capture the
              spread. Burn the supply. Non-custodial, fully on-chain, and built for composability.
            </MotionText>
            <MotionHStack
              spacing={4}
              flexWrap="wrap"
              justify="center"
              variants={fadeInUp}
            >
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
            </MotionHStack>
          </MotionStack>

          {/* Features Grid */}
          <MotionSimpleGrid
            columns={{ base: 1, md: 3 }}
            spacing={6}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
          >
            {features.map((feature, index) => (
              <MotionStack
                key={feature.title}
                spacing={4}
                p={6}
                borderRadius="lg"
                borderWidth="1px"
                borderColor="brand.subtle"
                bg="bg.surface"
                boxShadow="sm"
                h="100%"
                variants={fadeInUp}
                whileHover={{
                  y: -8,
                  boxShadow: 'lg',
                  transition: { duration: 0.3 },
                }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                >
                  <Icon as={feature.icon} boxSize={10} color="purple.500" />
                </motion.div>
                <Heading size="md">{feature.title}</Heading>
                <Text color="text.secondary">{feature.description}</Text>
              </MotionStack>
            ))}
          </MotionSimpleGrid>

          {/* Flywheel Section */}
          <MotionStack
            spacing={6}
            p={{ base: 6, md: 10 }}
            borderRadius="2xl"
            bg="bg.surface"
            boxShadow="md"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scaleIn}
          >
            <MotionHeading
              size="lg"
              textAlign={{ base: 'left', md: 'center' }}
              variants={fadeIn}
            >
              How the flywheel spins
            </MotionHeading>
            <MotionSimpleGrid
              columns={{ base: 1, md: 3 }}
              spacing={6}
              variants={staggerContainer}
            >
              {phases.map((phase, index) => (
                <MotionStack
                  key={phase.title}
                  spacing={3}
                  variants={slideInFromLeft}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.15 }}
                  >
                    <Text fontWeight="semibold" color="purple.500" fontSize="2xl">
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </motion.div>
                  <Heading size="md">{phase.title}</Heading>
                  <Text color="text.secondary">{phase.copy}</Text>
                </MotionStack>
              ))}
            </MotionSimpleGrid>
          </MotionStack>

          {/* Resources Section */}
          <MotionStack
            spacing={4}
            align="center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={fadeInUp}
          >
            <Heading size="md">Dive deeper</Heading>
            <Text color="text.secondary" textAlign="center" maxW="2xl">
              Whether you want to interact with the contracts, monitor liquidity, or browse active
              listings, everything lives inside the app. Start with the dashboard and explore from
              there.
            </Text>
            <MotionHStack
              spacing={6}
              flexWrap="wrap"
              justify="center"
              variants={staggerContainer}
            >
              {resources.map((resource) => (
                <motion.div key={resource.label} variants={fadeIn}>
                  <Link
                    as={NextLink}
                    href={resource.href}
                    fontWeight="semibold"
                    color="brand.primary"
                    _hover={{ textDecoration: 'underline' }}
                  >
                    {resource.label}
                  </Link>
                </motion.div>
              ))}
            </MotionHStack>
          </MotionStack>

          <Divider />

          {/* CTA Section */}
          <MotionStack
            spacing={4}
            align="center"
            textAlign="center"
            p={{ base: 6, md: 10 }}
            borderRadius="2xl"
            bg="purple.600"
            color="white"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scaleIn}
            whileHover={{
              scale: 1.02,
              boxShadow: '2xl',
              transition: { duration: 0.3 },
            }}
          >
            <MotionHeading size="lg" variants={fadeInUp}>
              Ready to automate your NFT treasury?
            </MotionHeading>
            <MotionText maxW="2xl" variants={fadeInUp}>
              Connect a devnet wallet, monitor treasury health, and trigger buys or burns in a few
              clicks. The strategy contract handles the rest.
            </MotionText>
            <motion.div variants={fadeInUp}>
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
            </motion.div>
          </MotionStack>
        </Stack>
      </Container>
    </Box>
  );
}
