export const appConfig = {
  version: '1.6.0',
  standalone: false,
  defaultCollection: '',
  agent: {
    address: '0x22ddc627a3c721ad10b18890bc95aca76d33432c'.toLowerCase(),
    name: 'EtherBot',
    env: 'dev' as 'dev' | 'local' | 'production' | undefined,
  },
};
