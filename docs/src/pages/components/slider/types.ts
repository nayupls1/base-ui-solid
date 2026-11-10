import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesSlider = createMultipleTypes(data);
export const TypesSliderAdditional = (_props: Record<string, unknown>) => null;
