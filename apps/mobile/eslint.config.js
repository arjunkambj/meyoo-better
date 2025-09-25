import { config as reactInternal } from '@repo/eslint-config/react-internal';

export default [
  ...reactInternal,
  {
    ignores: ['dist/**']
  }
];
