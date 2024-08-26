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
      const owner = privateKeyToAccount(privateKey);

      return {
        signatory: owner,
        owner: owner.address,
      };
    },
    canLogout: () => false,
  };
};
