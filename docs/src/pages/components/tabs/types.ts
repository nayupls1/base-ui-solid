import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesTabs = createMultipleTypes(data);
export const TypesTabsAdditional = (_props: Record<string, unknown>) => null;
