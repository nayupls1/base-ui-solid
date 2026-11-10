import type { Component } from 'solid-js';

export interface DemoFile {
  name: string;
  language: string;
  code: string;
  html: string;
}

export interface DemoVariant {
  component: Component;
  files: DemoFile[];
}

export interface DemoProps {
  variants: Record<string, DemoVariant>;
  name?: string;
  slug?: string;
  class?: string;
}
