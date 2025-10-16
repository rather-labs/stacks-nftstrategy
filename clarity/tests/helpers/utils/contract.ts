import { ClarityValue } from "@stacks/transactions";
import { signers } from "./accounts";
import { SimnetResult } from "./types";

/**
 * Contract interaction helper functions
 */
export const contract = {
  /**
   * Call a public function
   * @param contractName - Contract name (without deployer prefix)
   * @param functionName - Function to call
   * @param args - Function arguments
   * @param caller - Optional caller address (defaults to deployer)
   * @returns Simnet result
   */
  call: (
    contractName: string,
    functionName: string,
    args: ClarityValue[] = [],
    caller?: string
  ): SimnetResult => {
    const { deployer } = signers();
    return simnet.callPublicFn(
      contractName,
      functionName,
      args,
      caller || deployer
    );
  },

  /**
   * Call a read-only function
   * @param contractName - Contract name (without deployer prefix)
   * @param functionName - Function to call
   * @param args - Function arguments
   * @param caller - Optional caller address (defaults to alice)
   * @returns Simnet result
   */
  readOnly: (
    contractName: string,
    functionName: string,
    args: ClarityValue[] = [],
    caller?: string
  ): SimnetResult => {
    const { alice } = signers();
    return simnet.callReadOnlyFn(
      contractName,
      functionName,
      args,
      caller || alice
    );
  },

  /**
   * Transfer STX between addresses
   * @param amount - Amount in micro-STX
   * @param recipient - Recipient address
   * @param sender - Optional sender address (defaults to deployer)
   * @returns Transfer result
   */
  transferSTX: (
    amount: bigint,
    recipient: string,
    sender?: string
  ): boolean => {
    const { deployer } = signers();
    const result = simnet.transferSTX(
      recipient,
      amount,
      sender || deployer
    );
    return result.result === true;
  },

  /**
   * Deploy a new contract
   * @param contractName - Contract name
   * @param contractCode - Contract source code
   * @param deployer - Optional deployer address
   * @returns Deployment result
   */
  deploy: (
    contractName: string,
    contractCode: string,
    deployer?: string
  ): SimnetResult => {
    const { deployer: defaultDeployer } = signers();
    return simnet.deployContract(
      contractName,
      contractCode,
      deployer || defaultDeployer
    );
  },

  /**
   * Get contract info
   * @param contractId - Full contract identifier (e.g., "ST1...deployer.contract-name")
   * @returns Contract info or null if not found
   */
  getInfo: (contractId: string): any => {
    return simnet.getContractInfo(contractId);
  },

  /**
   * Check if a contract exists
   * @param contractId - Full contract identifier
   * @returns True if contract exists
   */
  exists: (contractId: string): boolean => {
    return simnet.getContractInfo(contractId) !== null;
  },

  /**
   * Get the full contract identifier
   * @param contractName - Contract name
   * @param deployer - Optional deployer address (defaults to test deployer)
   * @returns Full contract identifier
   */
  getId: (contractName: string, deployer?: string): string => {
    const { deployer: defaultDeployer } = signers();
    return `${deployer || defaultDeployer}.${contractName}`;
  },

  /**
   * Call multiple functions in a single block
   * @param calls - Array of function calls
   * @returns Array of results
   */
  multicall: (
    calls: Array<{
      contractName: string;
      functionName: string;
      args?: ClarityValue[];
      caller?: string;
    }>
  ): SimnetResult[] => {
    return calls.map(({ contractName, functionName, args = [], caller }) =>
      contract.call(contractName, functionName, args, caller)
    );
  },

  /**
   * Execute a function and return only the success value (throws on error)
   * @param contractName - Contract name
   * @param functionName - Function to call
   * @param args - Function arguments
   * @param caller - Optional caller address
   * @returns Success value
   * @throws Error if the call fails
   */
  callExpectOk: (
    contractName: string,
    functionName: string,
    args: ClarityValue[] = [],
    caller?: string
  ): ClarityValue => {
    const result = contract.call(contractName, functionName, args, caller);
    if (result.result.type === 'ok') {
      return result.result.value;
    }
    throw new Error(`Contract call failed: ${JSON.stringify(result.result)}`);
  },
};