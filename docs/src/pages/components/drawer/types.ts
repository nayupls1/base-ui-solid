import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesDrawer = createMultipleTypes(data);
export const TypesDrawerAdditional = (_props: Record<string, unknown>) => null;
