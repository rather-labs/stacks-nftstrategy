'use client';

import { Box, Container, Flex, Link, IconButton, useColorMode, Image } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { useContext, useCallback, useMemo } from 'react';
import { HiroWalletContext } from './HiroWalletProvider';
import { useDevnetWallet } from '@/lib/devnet-wallet-context';
import { DevnetWalletButton } from './DevnetWalletButton';
import { ConnectWalletButton } from './ConnectWallet';
import { NetworkSelector } from './NetworkSelector';
import { isDevnetEnvironment, useNetwork } from '@/lib/use-network';
import { useCurrentAddress } from '@/hooks/useCurrentAddress';
import { getStrategyContract } from '@/constants/contracts';

export const Navbar = () => {
  const { isWalletConnected } = useContext(HiroWalletContext);
  const { currentWallet, wallets, setCurrentWallet } = useDevnetWallet();
  const { colorMode, toggleColorMode } = useColorMode();
  const network = useNetwork();
  const currentAddress = useCurrentAddress();
  const strategyDeployer = useMemo(() => {
    if (!network || network === 'devnet') return null;
    return getStrategyContract(network).contractAddress;
  }, [network]);
  const normalizedCurrent = currentAddress?.toUpperCase() ?? null;
  const normalizedDeployer = strategyDeployer?.toUpperCase() ?? null;
  const showAdminLink =
    network !== 'testnet' ||
    (!!normalizedCurrent && !!normalizedDeployer && normalizedCurrent === normalizedDeployer);

  const handleConnect = useCallback(async () => {
    if (!isWalletConnected) {
      try {
        const { connect } = await import('@stacks/connect');
        // In the latest API, connect() doesn't take appDetails directly
        // It's now handled through the request method with forceWalletSelect option
        await connect();
        window.location.reload();
      } catch (error) {
        console.error('Failed to load @stacks/connect:', error);
      }
    }
  }, [isWalletConnected]);

  return (
    <Box as="nav" bg="bg.surface" boxShadow="sm">
      <Container maxW="container.xl">
        <Flex justify="space-between" h={16} align="center">
          <Flex align="center" gap={3}>
            <Link href="/" _hover={{ opacity: 0.8 }} transition="opacity 0.2s">
              <Image
                src={colorMode === 'dark' ? '/images/rather-white.svg' : '/images/rather-dark.svg'}
                alt="RATHER Labs"
                height="35px"
                width="auto"
              />
            </Link>
            <Box height="30px" width="1px" bg="border.default" />
            <Link href="/" textDecoration="none" _hover={{ opacity: 0.8 }}>
              <Box fontSize="lg" fontWeight="bold" color="text.primary">
                Strategy Protocol
              </Box>
            </Link>
          </Flex>
          <Flex align="center" gap={6}>
            <Link href="/strategy">
              <Box>Dashboard</Box>
            </Link>
            <Link href="/marketplace">
              <Box>Marketplace</Box>
            </Link>
            <Link href="/liquidity">
              <Box>Liquidity Pool</Box>
            </Link>
            {showAdminLink && (
              <Link href="/admin">
                <Box>Admin</Box>
              </Link>
            )}
            <IconButton
              aria-label="Toggle color mode"
              icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
              onClick={toggleColorMode}
              variant="ghost"
              size="sm"
            />
            <NetworkSelector />
            {isDevnetEnvironment() ? (
              <DevnetWalletButton
                currentWallet={currentWallet}
                wallets={wallets}
                onWalletSelect={setCurrentWallet}
              />
            ) : (
              <ConnectWalletButton />
            )}
          </Flex>
        </Flex>
      </Container>
    </Box>
  );
};
