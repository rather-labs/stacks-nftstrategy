'use client';

import Image from 'next/image';
import { Box, Center, Spinner } from '@chakra-ui/react';
import { useTokenUri } from '@/hooks/useTokenUri';

interface TokenImageProps {
  tokenId: number;
  alt: string;
  aspectRatio?: string;
  borderRadius?: string | number;
}

export const TokenImage = ({
  tokenId,
  alt,
  aspectRatio = '1 / 1',
  borderRadius = 'lg',
}: TokenImageProps) => {
  const { data: tokenUri, isLoading } = useTokenUri(tokenId);

  return (
    <Box
      position="relative"
      w="100%"
      sx={{ aspectRatio }}
      borderRadius={borderRadius}
      overflow="hidden"
      bg="gray.100"
    >
      {isLoading ? (
        <Center inset={0} position="absolute">
          <Spinner size="lg" />
        </Center>
      ) : tokenUri ? (
        <Image
          src={tokenUri}
          alt={alt}
          fill
          sizes="(min-width: 768px) 240px, 100vw"
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <Center
          inset={0}
          position="absolute"
          color="gray.500"
          fontSize="sm"
          px={4}
          textAlign="center"
        >
          No preview available
        </Center>
      )}
    </Box>
  );
};
