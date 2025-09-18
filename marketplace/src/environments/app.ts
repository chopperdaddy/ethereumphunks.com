export const appConfig = {
  version: '1.6.5',
  standalone: false,
  defaultCollection: '',
  agent: {
    enabled: false,
    address: '0x22ddc627a3c721ad10b18890bc95aca76d33432c'.toLowerCase(),
    name: 'Japhar',
    env: 'production' as 'dev' | 'local' | 'production' | undefined,
  },
};
