import { createDemoWithVariants } from 'docs/src/utils/createDemo';
import CssModules from './css-modules';
import CssModulesFiles from './css-modules/index.tsx?demo-files';
import Tailwind from './tailwind';
import TailwindFiles from './tailwind/index.tsx?demo-files';

export const DemoComboboxAsyncSingle = createDemoWithVariants(
  {
    CssModules: { component: CssModules, files: CssModulesFiles },
    Tailwind: { component: Tailwind, files: TailwindFiles },
  },
  { slug: 'async-single' },
);
