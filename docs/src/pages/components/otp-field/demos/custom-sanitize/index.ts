import { createDemoWithVariants } from 'docs/src/utils/createDemo';
import CssModules from './css-modules';
import CssModulesFiles from './css-modules/index.tsx?demo-files';

export const DemoOTPFieldCustomNormalize = createDemoWithVariants(
  {
    CssModules: { component: CssModules, files: CssModulesFiles },
  },
  { slug: 'custom-sanitize' },
);
