import { TestAccounts } from "./types";

/**
 * Get test accounts from simnet
 * @returns Object containing deployer, alice, bob, and charlie addresses
 */
export const signers = (): TestAccounts => {
  const accounts = simnet.getAccounts();
  return {
    deployer: accounts.get("deployer")!,
    alice: accounts.get("wallet_1")!,
    bob: accounts.get("wallet_2")!,
    charlie: accounts.get("wallet_3")!,
  };
};

/**
 * Get a specific test account by name
 * @param name - Account name ('deployer' | 'alice' | 'bob' | 'charlie')
 * @returns Account address
 */
export const getAccount = (name: keyof TestAccounts): string => {
  const accounts = signers();
  return accounts[name];
};

/**
 * Get all test accounts as an array
 * @returns Array of account addresses
 */
export const getAllAccounts = (): string[] => {
  const accounts = signers();
  return Object.values(accounts);
};