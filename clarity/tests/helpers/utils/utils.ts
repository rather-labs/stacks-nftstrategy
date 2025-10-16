import { PRICES } from "../constants";

/**
 * Utility helper functions for tests
 */
export const utils = {
  /**
   * Mine empty blocks
   * @param count - Number of blocks to mine
   */
  mineBlocks: (count: number): void => {
    simnet.mineEmptyBlocks(count);
  },

  /**
   * Convert STX to micro-STX
   * @param stx - Amount in STX
   * @returns Amount in micro-STX
   */
  stxToMicro: (stx: number): number => {
    return stx * PRICES.STX_TO_MICRO;
  },

  /**
   * Convert micro-STX to STX
   * @param microStx - Amount in micro-STX
   * @returns Amount in STX
   */
  microToStx: (microStx: number): number => {
    return microStx / PRICES.STX_TO_MICRO;
  },

  /**
   * Get the current block height
   * @returns Current block height
   */
  getBlockHeight: (): number => {
    return simnet.getBlockHeight();
  },

  /**
   * Get block time (timestamp) for a specific block
   * @param blockHeight - The block height
   * @returns Block timestamp
   */
  getBlockTime: (blockHeight: number): number => {
    return simnet.getBlockTime(blockHeight);
  },

  /**
   * Mine blocks until a specific block height
   * @param targetHeight - Target block height
   */
  mineUntilBlock: (targetHeight: number): void => {
    const currentHeight = utils.getBlockHeight();
    const blocksToMine = targetHeight - currentHeight;
    if (blocksToMine > 0) {
      utils.mineBlocks(blocksToMine);
    }
  },

  /**
   * Format micro-STX amount for display
   * @param microStx - Amount in micro-STX
   * @returns Formatted string (e.g., "1.5 STX")
   */
  formatSTX: (microStx: number | bigint): string => {
    const stx = Number(microStx) / PRICES.STX_TO_MICRO;
    return `${stx.toFixed(6).replace(/\.?0+$/, "")} STX`;
  },

  /**
   * Sleep for a specified duration (useful for testing async operations)
   * @param ms - Milliseconds to sleep
   */
  sleep: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate a random number between min and max (inclusive)
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns Random number
   */
  randomInt: (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Create a unique identifier for testing
   * @param prefix - Optional prefix
   * @returns Unique string
   */
  uniqueId: (prefix: string = "test"): string => {
    return `${prefix}-${Date.now()}-${utils.randomInt(1000, 9999)}`;
  },
};