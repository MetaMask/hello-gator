import { Signatory, WalletClientAccount } from "@codefi/delegator-core-viem";
import { OPENLOGIN_NETWORK_TYPE } from "@web3auth/base";
import { Address, Chain } from "viem";

export type SignatoryFactoryConfig = {
  web3AuthClientId: string;
  web3AuthNetwork: OPENLOGIN_NETWORK_TYPE;
  chain: Chain;
  rpcUrl: string;
};

export type SignatoryLoginFunction = () => Promise<{
  signatory: Signatory | WalletClientAccount;
  owner: Address;
}>;

export type SignatoryLogoutFunction = () => Promise<void>;

export type SignatoryFactory = {
  login: SignatoryLoginFunction;
  canLogout: () => boolean;
  isDisabled?: boolean;
  logout?: SignatoryLogoutFunction;
};

export type SignatoryFactoryConfigurator = (
  config: SignatoryFactoryConfig
) => SignatoryFactory;

export const UnconfiguredSignatory: SignatoryFactory = {
  login: () => {
    throw new Error("Signatory not configured");
  },
  canLogout: () => false,
  isDisabled: true,
};
