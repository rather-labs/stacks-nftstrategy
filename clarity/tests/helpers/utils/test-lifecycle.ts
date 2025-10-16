import { utils } from "./utils";
import { contract } from "./contract";
import { SetupOptions } from "./types";

declare const simnet: any;

/**
 * Test lifecycle helper functions
 */
export const testHelpers = {
  /**
   * Setup a test environment with initial state
   * @param options - Setup options
   */
  setup: (options?: SetupOptions): void => {
    if (options?.mineBlocks) {
      utils.mineBlocks(options.mineBlocks);
    }

    if (options?.fundAccounts) {
      options.fundAccounts.forEach(({ address, amount }) => {
        contract.transferSTX(amount, address);
      });
    }
  },

  /**
   * Get the simnet instance (for advanced use cases)
   * @returns The simnet instance
   */
  getSimnet: () => simnet,

  /**
   * Reset the blockchain state
   * Warning: This will clear all deployed contracts and transactions
   */
  reset: (): void => {
    if (simnet.reset) {
      simnet.reset();
    }
  },

  /**
   * Snapshot the current blockchain state
   * @returns Snapshot ID
   */
  snapshot: (): string => {
    if (simnet.createSnapshot) {
      return simnet.createSnapshot();
    }
    return "snapshot-not-supported";
  },

  /**
   * Restore a blockchain state snapshot
   * @param snapshotId - Snapshot ID to restore
   */
  restore: (snapshotId: string): void => {
    if (simnet.restoreSnapshot) {
      simnet.restoreSnapshot(snapshotId);
    }
  },

  /**
   * Run a test with automatic cleanup
   * @param testFn - Test function to run
   * @param options - Setup options
   */
  withCleanup: async (
    testFn: () => void | Promise<void>,
    options?: SetupOptions
  ): Promise<void> => {
    const snapshotId = testHelpers.snapshot();
    
    try {
      if (options) {
        testHelpers.setup(options);
      }
      await testFn();
    } finally {
      testHelpers.restore(snapshotId);
    }
  },

  /**
   * Get test statistics
   * @returns Object with test statistics
   */
  getStats: () => ({
    blockHeight: utils.getBlockHeight(),
    assetsMap: simnet.getAssetsMap(),
    contracts: simnet.getContractsMap ? simnet.getContractsMap() : {},
  }),
};