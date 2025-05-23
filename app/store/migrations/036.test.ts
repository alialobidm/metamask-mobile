/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
import { EthAccountType, EthMethod, EthScope } from '@metamask/keyring-api';
import { InternalAccount } from '@metamask/keyring-internal-api';
import migrate, { Identity } from './036';
import { captureException } from '@sentry/react-native';
import { getUUIDFromAddressOfNormalAccount } from '@metamask/accounts-controller';
import { KeyringTypes } from '@metamask/keyring-controller';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));
const mockedCaptureException = jest.mocked(captureException);

const MOCK_ADDRESS_1 = '0x0';
const MOCK_ADDRESS_2 = '0x1';

interface Identities {
  [key: string]: Identity;
}

function createMockPreferenceControllerState(
  identities: Identity[] = [{ name: 'Account 1', address: MOCK_ADDRESS_1 }],
  selectedAddress?: string,
): {
  identities: Identities;
  selectedAddress?: string;
} {
  const state: {
    identities: Identities;
    selectedAddress?: string;
  } = {
    identities: {},
    selectedAddress,
  };

  identities.forEach(({ address, name, lastSelected }) => {
    state.identities[address] = {
      address,
      name,
      lastSelected,
    };
  });

  return state;
}

function expectedInternalAccount(
  address: string,
  nickname: string,
  lastSelected?: number,
): InternalAccount {
  return {
    address,
    scopes: [EthScope.Eoa],
    id: getUUIDFromAddressOfNormalAccount(address),
    metadata: {
      name: nickname,
      importTime: Date.now(),
      keyring: {
        type: KeyringTypes.hd,
      },
      lastSelected: lastSelected ? expect.any(Number) : undefined,
    },
    options: {},
    methods: [
      EthMethod.PersonalSign,
      EthMethod.SignTransaction,
      EthMethod.SignTypedDataV1,
      EthMethod.SignTypedDataV3,
      EthMethod.SignTypedDataV4,
    ],
    type: EthAccountType.Eoa,
  };
}

function createMockState(
  preferenceState: {
    identities: Identities;
    selectedAddress?: string;
  } = createMockPreferenceControllerState(),
) {
  return {
    engine: {
      backgroundState: {
        PreferencesController: {
          ...preferenceState,
        },
        KeyringController: { vault: {} },
      },
    },
  };
}

describe('Migration #036', () => {
  beforeEach(() => {
    mockedCaptureException.mockReset();
  });

  describe('createDefaultAccountsController', () => {
    it('should throw if state.engine is not defined', () => {
      const newState = migrate({});
      expect(newState).toStrictEqual({});
      expect(mockedCaptureException).toHaveBeenCalledWith(expect.any(Error));
      expect(mockedCaptureException.mock.calls[0][0].message).toBe(
        `Migration 36: Invalid root engine state: 'undefined'`,
      );
    });
    it('should throw if state.engine.backgroundState is not defined', () => {
      const oldState = {
        engine: {
          backgroundState: undefined,
        },
      };
      const newState = migrate(oldState);
      expect(newState).toStrictEqual(oldState);
      expect(mockedCaptureException).toHaveBeenCalledWith(expect.any(Error));
      expect(mockedCaptureException.mock.calls[0][0].message).toBe(
        `Migration 36: Invalid root engine backgroundState: 'undefined'`,
      );
    });
    it('should throw if state.engine.backgroundState.PreferencesController is not defined', () => {
      const oldState = {
        engine: {
          backgroundState: {
            PreferencesController: undefined,
            KeyringController: { vault: {} },
          },
        },
      };
      const newState = migrate(oldState);
      expect(newState).toStrictEqual(oldState);
      expect(mockedCaptureException).toHaveBeenCalledWith(expect.any(Error));
      expect(mockedCaptureException.mock.calls[0][0].message).toBe(
        `Migration 36: Invalid PreferencesController state: 'undefined'`,
      );
    });
    it('should throw if state.engine.backgroundState.PreferencesController.identities is not defined', () => {
      const oldState = {
        engine: {
          backgroundState: {
            PreferencesController: {},
            KeyringController: { vault: {} },
          },
        },
      };
      const newState = migrate(oldState);
      expect(newState).toStrictEqual(oldState);
      expect(mockedCaptureException).toHaveBeenCalledWith(expect.any(Error));
      expect(mockedCaptureException.mock.calls[0][0].message).toBe(
        `Migration 36: Missing identities property from PreferencesController: 'object'`,
      );
    });
    it('creates default state for accounts controller', () => {
      const oldState = createMockState({
        identities: {
          [MOCK_ADDRESS_1]: {
            name: 'Account 1',
            address: MOCK_ADDRESS_1,
            lastSelected: undefined,
          },
        },
        selectedAddress: MOCK_ADDRESS_1,
      });
      const newState = migrate(oldState);
      const expectedUuid = getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_1);
      const resultInternalAccount = expectedInternalAccount(
        MOCK_ADDRESS_1,
        'Account 1',
      );

      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            AccountsController: {
              internalAccounts: {
                accounts: {
                  [expectedUuid]: resultInternalAccount,
                },
                selectedAccount: expectedUuid,
              },
            },
            PreferencesController: {
              identities: {
                '0x0': {
                  address: '0x0',
                  lastSelected: undefined,
                  name: 'Account 1',
                },
              },
              selectedAddress: '0x0',
            },
            KeyringController: { vault: {} },
          },
        },
      });
    });
  });

  describe('createInternalAccountsForAccountsController', () => {
    it('should create the identities into AccountsController as internal accounts', () => {
      const expectedUuid = getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_1);
      const oldState = createMockState({
        identities: {
          [MOCK_ADDRESS_1]: {
            name: 'Account 1',
            address: MOCK_ADDRESS_1,
            lastSelected: undefined,
          },
        },
        selectedAddress: MOCK_ADDRESS_1,
      });

      const newState = migrate(oldState);

      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            AccountsController: {
              internalAccounts: {
                accounts: {
                  [expectedUuid]: expectedInternalAccount(
                    MOCK_ADDRESS_1,
                    `Account 1`,
                  ),
                },
                selectedAccount: expectedUuid,
              },
            },
            PreferencesController: expect.any(Object),
            KeyringController: { vault: {} },
          },
        },
      });
    });

    it('should keep the same name from the identities', () => {
      const expectedUuid = getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_1);
      const oldState = createMockState(
        createMockPreferenceControllerState(
          [{ name: 'a random name', address: MOCK_ADDRESS_1 }],
          MOCK_ADDRESS_1,
        ),
      );
      const newState = migrate(oldState);
      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            PreferencesController: expect.any(Object),
            AccountsController: {
              internalAccounts: {
                accounts: {
                  [expectedUuid]: expectedInternalAccount(
                    MOCK_ADDRESS_1,
                    `a random name`,
                  ),
                },
                selectedAccount: expectedUuid,
              },
            },
            KeyringController: { vault: {} },
          },
        },
      });
    });

    it('should be able to handle multiple identities', () => {
      const expectedUuid = getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_1);
      const expectedUuid2 = getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_2);
      const oldState = createMockState({
        identities: {
          [MOCK_ADDRESS_1]: { name: 'Account 1', address: MOCK_ADDRESS_1 },
          [MOCK_ADDRESS_2]: { name: 'Account 2', address: MOCK_ADDRESS_2 },
        },
        selectedAddress: MOCK_ADDRESS_2,
      });
      const newState = migrate(oldState);
      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            AccountsController: {
              internalAccounts: {
                accounts: {
                  [expectedUuid]: expectedInternalAccount(
                    MOCK_ADDRESS_1,
                    `Account 1`,
                  ),
                  [expectedUuid2]: expectedInternalAccount(
                    MOCK_ADDRESS_2,
                    `Account 2`,
                  ),
                },
                selectedAccount: expectedUuid2,
              },
            },
            PreferencesController: expect.any(Object),
            KeyringController: { vault: {} },
          },
        },
      });
    });

    it('should handle empty identities and create default AccountsController with no internal accounts', () => {
      const oldState = createMockState({
        // Simulate `identities` being an empty object
        identities: {},
      });
      const newState = migrate(oldState);

      expect(mockedCaptureException).toHaveBeenCalledWith(expect.any(Error));

      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            PreferencesController: expect.any(Object),
            AccountsController: {
              internalAccounts: {
                accounts: {}, // Expect no accounts to be created
                selectedAccount: '', // Expect no account to be selected
              },
            },
            KeyringController: { vault: {} },
          },
        },
      });
    });
  });

  describe('createSelectedAccountForAccountsController', () => {
    it('should select the same account as the selected address', () => {
      const oldState = createMockState(
        createMockPreferenceControllerState(
          [{ name: 'a random name', address: MOCK_ADDRESS_1 }],
          MOCK_ADDRESS_1,
        ),
      );
      const newState = migrate(oldState);
      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            PreferencesController: expect.any(Object),
            AccountsController: {
              internalAccounts: {
                accounts: expect.any(Object),
                selectedAccount:
                  getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_1),
              },
            },
            KeyringController: { vault: {} },
          },
        },
      });
    });

    it("should leave selectedAccount as empty if there aren't any selectedAddress", () => {
      const oldState = {
        engine: {
          backgroundState: {
            PreferencesController: {
              identities: {},
              selectedAddress: '',
            },
            KeyringController: { vault: {} },
          },
        },
      };
      const newState = migrate(oldState);
      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            PreferencesController: expect.any(Object),
            AccountsController: {
              internalAccounts: {
                accounts: expect.any(Object),
                selectedAccount: '',
              },
            },
            KeyringController: { vault: {} },
          },
        },
      });
    });
    it('should select the first account as the selected account if selectedAddress is undefined, and update PreferencesController accordingly', () => {
      const identities = [
        { name: 'Account 1', address: MOCK_ADDRESS_1 },
        { name: 'Account 2', address: MOCK_ADDRESS_2 },
      ];
      // explicitly set selectedAddress to undefined
      const oldState = createMockState(
        createMockPreferenceControllerState(identities, undefined),
      );
      const expectedUuid = getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_1);
      const expectedUuid2 = getUUIDFromAddressOfNormalAccount(MOCK_ADDRESS_2);

      expect(oldState).toStrictEqual({
        engine: {
          backgroundState: {
            PreferencesController: {
              selectedAddress: undefined,
              identities: {
                [MOCK_ADDRESS_1]: {
                  address: MOCK_ADDRESS_1,
                  name: 'Account 1',
                  lastSelected: undefined,
                },
                [MOCK_ADDRESS_2]: {
                  address: MOCK_ADDRESS_2,
                  name: 'Account 2',
                  lastSelected: undefined,
                },
              },
            },
            KeyringController: { vault: {} },
          },
        },
      });

      const newState = migrate(oldState);

      expect(mockedCaptureException).toHaveBeenCalledWith(expect.any(Error));

      expect(newState).toStrictEqual({
        engine: {
          backgroundState: {
            PreferencesController: {
              // Verifying that PreferencesController's selectedAddress is updated to the first account's address
              selectedAddress: MOCK_ADDRESS_1,
              identities: {
                [MOCK_ADDRESS_1]: {
                  address: MOCK_ADDRESS_1,
                  name: 'Account 1',
                  lastSelected: undefined,
                },
                [MOCK_ADDRESS_2]: {
                  address: MOCK_ADDRESS_2,
                  name: 'Account 2',
                  lastSelected: undefined,
                },
              },
            },
            AccountsController: {
              internalAccounts: {
                accounts: {
                  [expectedUuid]: expectedInternalAccount(
                    MOCK_ADDRESS_1,
                    `Account 1`,
                  ),
                  [expectedUuid2]: expectedInternalAccount(
                    MOCK_ADDRESS_2,
                    `Account 2`,
                  ),
                },
                // Verifying the accounts controller's selectedAccount is updated to the first account's UUID
                selectedAccount: expectedUuid,
              },
            },
            KeyringController: { vault: {} },
          },
        },
      });
    });

    it('should capture exception if internalAccount.id is undefined', () => {
      // Mock getUUIDFromAddressOfNormalAccount to return undefined
      jest
        .spyOn(
          require('@metamask/accounts-controller'),
          'getUUIDFromAddressOfNormalAccount',
        )
        .mockReturnValue(undefined);

      const oldState = createMockState(
        createMockPreferenceControllerState(
          [{ name: 'Account 1', address: MOCK_ADDRESS_1 }],
          undefined,
        ),
      );
      migrate(oldState);
      expect(mockedCaptureException.mock.calls[1][0].message).toBe(
        `Migration 36: selectedAccount will be undefined because internalAccount.id is undefined.`,
      );
    });

    it('should capture exception if selectedAccount.id is undefined', () => {
      // Mock getUUIDFromAddressOfNormalAccount to return undefined
      jest
        .spyOn(
          require('@metamask/accounts-controller'),
          'getUUIDFromAddressOfNormalAccount',
        )
        .mockReturnValue(undefined);

      const oldState = createMockState(
        createMockPreferenceControllerState(
          [{ name: 'Account 1', address: MOCK_ADDRESS_1 }],
          MOCK_ADDRESS_1,
        ),
      );
      migrate(oldState);
      expect(mockedCaptureException.mock.calls[0][0].message).toBe(
        `Migration 36: selectedAccount will be undefined because selectedAccount.id is undefined.`,
      );
    });
  });
});
