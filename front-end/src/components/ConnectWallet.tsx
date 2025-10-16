'use client';

import {
  Button,
  Flex,
  Tag,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  IconButton,
  Link,
  useToast,
  Box,
} from '@chakra-ui/react';
import { ChevronDownIcon, ExternalLinkIcon, CopyIcon } from '@chakra-ui/icons';
import { useContext, useState } from 'react';
import { HiroWalletContext } from './HiroWalletProvider';
import { getAccountExplorerLink } from '@/utils/explorer-links';

interface ConnectWalletButtonProps {
  children?: React.ReactNode;
  [key: string]: any;
}

export const ConnectWalletButton = (buttonProps: ConnectWalletButtonProps) => {
  const { children } = buttonProps;
  const toast = useToast();
  const { authenticate, isWalletConnected, mainnetAddress, testnetAddress, network, disconnect } =
    useContext(HiroWalletContext);

  const currentAddress = network === 'mainnet' ? mainnetAddress : testnetAddress;

  const copyAddress = () => {
    if (currentAddress) {
      navigator.clipboard.writeText(currentAddress);
      toast({
        title: 'Address copied',
        description: 'Wallet address copied to clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true,
        position: 'bottom-right',
      });
    }
  };

  const truncateMiddle = (str: string | null) => {
    if (!str) return '';
    if (str.length <= 12) return str;
    return `${str.slice(0, 6)}...${str.slice(-4)}`;
  };

  const networkLabel = network === 'mainnet' ? 'Mainnet' : 'Testnet';
  const networkColor = network === 'mainnet' ? 'blue' : 'purple';

  return isWalletConnected ? (
    <Menu>
      <Flex align="center" gap={0}>
        <Link
          href={getAccountExplorerLink(currentAddress || '', network)}
          target="_blank"
          _hover={{ textDecoration: 'none' }}
        >
          <Button
            variant="ghost"
            size="md"
            rightIcon={<ChevronDownIcon visibility="hidden" />}
            _hover={{ bg: 'bg.subtle' }}
          >
            <Flex align="center" gap={2}>
              <Box
                fontSize="sm"
                fontFamily="mono"
                width="140px"
                overflow="hidden"
                textOverflow="ellipsis"
                color="text.primary"
              >
                {truncateMiddle(currentAddress)}
              </Box>
              <Tag size="sm" colorScheme={networkColor} borderRadius="full">
                {networkLabel}
              </Tag>
            </Flex>
          </Button>
        </Link>
        <MenuButton
          as={IconButton}
          variant="ghost"
          icon={<ChevronDownIcon />}
          aria-label="Wallet options"
          size="md"
          _hover={{ bg: 'bg.subtle' }}
        />
      </Flex>
      <MenuList>
        <MenuItem icon={<CopyIcon />} onClick={copyAddress}>
          Copy Address
        </MenuItem>
        <MenuItem
          icon={<ExternalLinkIcon />}
          as={Link}
          href={getAccountExplorerLink(currentAddress || '', network)}
          target="_blank"
          _hover={{ textDecoration: 'none' }}
        >
          View in Explorer
        </MenuItem>
        <MenuDivider />
        <MenuItem onClick={disconnect} color="red.500" data-testid="disconnect-wallet-address-button">
          Disconnect Wallet
        </MenuItem>
      </MenuList>
    </Menu>
  ) : (
    <Button
      size="md"
      colorScheme="purple"
      onClick={authenticate}
      data-testid="wallet-connect-button"
      {...buttonProps}
    >
      {children || 'Connect Wallet'}
    </Button>
  );
};
