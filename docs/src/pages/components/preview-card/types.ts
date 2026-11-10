import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesPreviewCard = createMultipleTypes(data);
export const TypesPreviewCardAdditional = (_props: Record<string, unknown>) => null;
