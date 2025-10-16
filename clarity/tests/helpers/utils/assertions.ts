import { Cl, ClarityValue } from "@stacks/transactions";
import { expect } from "vitest";

/**
 * Clarity-specific test assertion helpers
 */
export const assertions = {
  /**
   * Assert that a result is Ok with expected value
   * @param result - The Clarity result
   * @param value - Expected value
   */
  expectOk: (result: ClarityValue, value: ClarityValue): void => {
    expect(result).toEqual(Cl.ok(value));
  },

  /**
   * Assert that a result is an error with expected code
   * @param result - The Clarity result
   * @param code - Expected error code
   */
  expectErr: (result: ClarityValue, code: number): void => {
    expect(result).toEqual(Cl.error(Cl.uint(code)));
  },

  /**
   * Assert that a result is Some with expected value
   * @param result - The Clarity result
   * @param value - Expected value
   */
  expectSome: (result: ClarityValue, value: ClarityValue): void => {
    expect(result).toEqual(Cl.some(value));
  },

  /**
   * Assert that a result is None
   * @param result - The Clarity result
   */
  expectNone: (result: ClarityValue): void => {
    expect(result).toEqual(Cl.none());
  },

  /**
   * Assert that a result is a specific principal
   * @param result - The Clarity result
   * @param principal - Expected principal address
   */
  expectPrincipal: (result: ClarityValue, principal: string): void => {
    expect(result).toEqual(Cl.principal(principal));
  },

  /**
   * Assert that a result is a specific uint
   * @param result - The Clarity result
   * @param value - Expected uint value
   */
  expectUint: (result: ClarityValue, value: number | bigint): void => {
    expect(result).toEqual(Cl.uint(value));
  },

  /**
   * Assert that a result is a specific boolean
   * @param result - The Clarity result
   * @param value - Expected boolean value
   */
  expectBool: (result: ClarityValue, value: boolean): void => {
    expect(result).toEqual(Cl.bool(value));
  },

  /**
   * Assert that a result is a specific string (ASCII or UTF8)
   * @param result - The Clarity result
   * @param value - Expected string value
   * @param type - String type ('ascii' or 'utf8')
   */
  expectString: (result: ClarityValue, value: string, type: 'ascii' | 'utf8' = 'ascii'): void => {
    if (type === 'ascii') {
      expect(result).toEqual(Cl.stringAscii(value));
    } else {
      expect(result).toEqual(Cl.stringUtf8(value));
    }
  },

  /**
   * Assert that a result is a tuple with expected properties
   * @param result - The Clarity result
   * @param properties - Expected tuple properties
   */
  expectTuple: (result: ClarityValue, properties: Record<string, ClarityValue>): void => {
    expect(result).toEqual(Cl.tuple(properties));
  },

  /**
   * Assert that a result is a list with expected values
   * @param result - The Clarity result
   * @param values - Expected list values
   */
  expectList: (result: ClarityValue, values: ClarityValue[]): void => {
    expect(result).toEqual(Cl.list(values));
  },

  /**
   * Assert that an event was emitted with expected properties
   * @param events - Array of events from transaction
   * @param eventType - Expected event type
   * @param properties - Expected event properties
   */
  expectEvent: (events: any[], eventType: string, properties?: Record<string, any>): void => {
    const event = events.find(e => e.type === eventType);
    expect(event).toBeDefined();
    
    if (properties) {
      Object.entries(properties).forEach(([key, value]) => {
        expect(event[key]).toEqual(value);
      });
    }
  },

  /**
   * Assert that no events were emitted
   * @param events - Array of events from transaction
   */
  expectNoEvents: (events: any[]): void => {
    expect(events).toHaveLength(0);
  },
};

// Re-export expect for convenience
export { expect } from "vitest";