import type {
  SignatoryFactoryConfig,
  SignatoryFactoryConfigurator,
} from "./SignatoryTypes";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const createBurnerSignatoryFactory: SignatoryFactoryConfigurator = (
  config: SignatoryFactoryConfig
) => {
  return {
    login: async () => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      return {
        signatory: { account },
        owner: account.address,
      };
    },
    canLogout: () => false,
  };
};
