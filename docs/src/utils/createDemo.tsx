import type { Component } from 'solid-js';
import { Demo } from '../components/Demo/Demo';
import type { DemoFile } from '../components/Demo/types';

interface DemoMeta {
  name?: string;
  slug?: string;
}

type VariantInput = { component: Component; files: DemoFile[] };

/**
 * Creates a demo component for displaying code examples with syntax highlighting.
 * A variant is a different implementation style of the same component.
 */
export function createDemoWithVariants(
  variants: Record<string, VariantInput>,
  meta: DemoMeta = {},
) {
  return function DemoWithVariants(props: { class?: string }) {
    return <Demo variants={variants} name={meta.name} slug={meta.slug} class={props.class} />;
  };
}

/**
 * Creates a demo component for displaying code examples with syntax highlighting.
 */
export function createDemo(component: Component, files: DemoFile[], meta: DemoMeta = {}) {
  return createDemoWithVariants({ Default: { component, files } }, meta);
}

/**
 * Placeholder for upstream demos that use components which aren't ported yet.
 */
export function createPendingDemo(components: string[]) {
  return function PendingDemo() {
    return (
      <div class="DemoRoot">
        <div class="DemoPlayground">
          <p class="DemoPlaygroundInner" style={{ 'text-align': 'center' }}>
            This demo uses {components.join(', ')}, which {components.length > 1 ? "aren't" : "isn't"}{' '}
            ported to Solid yet.
          </p>
        </div>
      </div>
    );
  };
}
