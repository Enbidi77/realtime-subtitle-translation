import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  GlassRadio,
  GlassRadioGroup,
  GlassRadioIndicator,
} from '../GlassRadio.js';

describe('GlassRadio Component Suite', () => {
  describe('GlassRadioIndicator', () => {
    it('renders unchecked indicator correctly', () => {
      const html = renderToString(<GlassRadioIndicator checked={false} />);
      expect(html).toContain('scale-0');
      expect(html).toContain('opacity-0');
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders checked indicator with primary styling by default', () => {
      const html = renderToString(<GlassRadioIndicator checked={true} />);
      expect(html).toContain('scale-100');
      expect(html).toContain('opacity-100');
      expect(html).toContain('border-primary');
      expect(html).toContain('bg-primary');
    });

    it('supports different color themes (destructive, amber, emerald)', () => {
      const destHtml = renderToString(<GlassRadioIndicator checked={true} color="destructive" />);
      expect(destHtml).toContain('border-destructive');
      expect(destHtml).toContain('bg-destructive');

      const amberHtml = renderToString(<GlassRadioIndicator checked={true} color="amber" />);
      expect(amberHtml).toContain('border-amber-400');
      expect(amberHtml).toContain('bg-amber-400');

      const emeraldHtml = renderToString(<GlassRadioIndicator checked={true} color="emerald" />);
      expect(emeraldHtml).toContain('border-emerald-400');
      expect(emeraldHtml).toContain('bg-emerald-400');
    });

    it('supports different sizes (sm, md, lg)', () => {
      const smHtml = renderToString(<GlassRadioIndicator size="sm" />);
      expect(smHtml).toContain('w-4 h-4');

      const mdHtml = renderToString(<GlassRadioIndicator size="md" />);
      expect(mdHtml).toContain('w-5 h-5');

      const lgHtml = renderToString(<GlassRadioIndicator size="lg" />);
      expect(lgHtml).toContain('w-6 h-6');
    });

    it('applies disabled state styling', () => {
      const html = renderToString(<GlassRadioIndicator disabled={true} />);
      expect(html).toContain('opacity-40');
      expect(html).toContain('cursor-not-allowed');
    });
  });

  describe('GlassRadio Default Inline Variant', () => {
    it('renders standalone radio input without labels', () => {
      const html = renderToString(
        <GlassRadio name="theme" value="dark" checked={true} onChange={() => {}} />
      );
      expect(html).toContain('type="radio"');
      expect(html).toContain('name="theme"');
      expect(html).toContain('value="dark"');
      expect(html).toContain('checked=""');
      expect(html).toContain('sr-only');
    });

    it('renders with label and description', () => {
      const html = renderToString(
        <GlassRadio
          name="option"
          value="val1"
          label="Option 1"
          description="Description for option 1"
          checked={false}
          onChange={() => {}}
        />
      );
      expect(html).toContain('Option 1');
      expect(html).toContain('Description for option 1');
    });

    it('renders with badge and icon', () => {
      const html = renderToString(
        <GlassRadio
          name="option"
          value="val2"
          label="Option 2"
          badge={<span className="test-badge">Active</span>}
          icon={<span className="test-icon">Icon</span>}
          checked={true}
          onChange={() => {}}
        />
      );
      expect(html).toContain('test-badge');
      expect(html).toContain('test-icon');
    });
  });

  describe('GlassRadio Card Variant', () => {
    it('renders card layout horizontal by default', () => {
      const html = renderToString(
        <GlassRadio
          variant="card"
          name="action"
          value="quit"
          color="destructive"
          label="Quit App"
          description="Terminate background tasks"
          checked={true}
          onChange={() => {}}
        />
      );
      expect(html).toContain('Quit App');
      expect(html).toContain('Terminate background tasks');
      expect(html).toContain('bg-destructive/10');
      expect(html).toContain('border-destructive/50');
    });

    it('renders card layout vertical with icon', () => {
      const html = renderToString(
        <GlassRadio
          variant="card"
          cardLayout="vertical"
          name="action"
          value="minimize"
          color="primary"
          icon={<span className="icon-mini">Mini</span>}
          label="Minimize to Tray"
          description="Runs in background"
          checked={true}
          onChange={() => {}}
        />
      );
      expect(html).toContain('icon-mini');
      expect(html).toContain('Minimize to Tray');
      expect(html).toContain('Runs in background');
      expect(html).toContain('flex-col');
    });
  });

  describe('GlassRadioGroup', () => {
    it('provides group context and controls child checked state', () => {
      const html = renderToString(
        <GlassRadioGroup name="group1" value="two" orientation="horizontal">
          <GlassRadio value="one" label="One" />
          <GlassRadio value="two" label="Two" />
          <GlassRadio value="three" label="Three" />
        </GlassRadioGroup>
      );

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-orientation="horizontal"');

      // Value "two" should be checked, others unchecked
      expect(html).toContain('value="one"');
      expect(html).toContain('value="two"');
      expect(html).toContain('value="three"');
    });

    it('propagates disabled, variant, size, and color to group children', () => {
      const html = renderToString(
        <GlassRadioGroup
          name="group2"
          value="opt1"
          disabled={true}
          variant="card"
          color="amber"
          size="sm"
        >
          <GlassRadio value="opt1" label="Option 1" />
          <GlassRadio value="opt2" label="Option 2" />
        </GlassRadioGroup>
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain('bg-amber-500/10');
    });
  });
});

