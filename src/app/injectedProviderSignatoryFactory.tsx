import { createWalletClient, custom, toHex, type Address } from "viem";
import {
  UnconfiguredSignatory,
  type SignatoryFactoryConfig,
  type SignatoryFactoryConfigurator,
} from "./SignatoryTypes";

export const createInjectedProviderSignatoryFactory: SignatoryFactoryConfigurator =
  (config: SignatoryFactoryConfig) => {
    const { chain } = config;

    const provider = (window as any).ethereum;

    if (!provider) {
      return UnconfiguredSignatory;
    }

    const login = async () => {
      const selectedNetwork = await provider.request({ method: "eth_chainId" });
      if (parseInt(selectedNetwork) !== chain.id) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [
            {
              chainId: toHex(chain.id),
            },
          ],
        });
      }

      const [owner] = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];

      const signatory = createWalletClient({
        chain,
        transport: custom(provider),
        account: owner,
      });

      return {
        owner,
        signatory,
      };
    };

    return { login, canLogout: () => false };
  };
