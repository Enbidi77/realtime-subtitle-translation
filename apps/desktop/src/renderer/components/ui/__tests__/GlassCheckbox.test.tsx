import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  GlassCheckbox,
  GlassCheckboxIndicator,
} from '../GlassCheckbox.js';

describe('GlassCheckbox Component Suite', () => {
  describe('GlassCheckboxIndicator', () => {
    it('renders unchecked default indicator correctly', () => {
      const html = renderToString(<GlassCheckboxIndicator checked={false} />);
      expect(html).toContain('scale-50');
      expect(html).toContain('opacity-0');
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders checked indicator with primary styling by default', () => {
      const html = renderToString(<GlassCheckboxIndicator checked={true} />);
      expect(html).toContain('scale-100');
      expect(html).toContain('opacity-100');
      expect(html).toContain('bg-primary');
      expect(html).toContain('border-primary');
    });

    it('renders indeterminate state with minus icon', () => {
      const html = renderToString(<GlassCheckboxIndicator indeterminate={true} />);
      expect(html).toContain('scale-100');
      expect(html).toContain('opacity-100');
      expect(html).toContain('lucide-minus');
    });

    it('supports different color themes (destructive, amber, emerald)', () => {
      const destHtml = renderToString(<GlassCheckboxIndicator checked={true} color="destructive" />);
      expect(destHtml).toContain('border-destructive');
      expect(destHtml).toContain('bg-destructive');

      const amberHtml = renderToString(<GlassCheckboxIndicator checked={true} color="amber" />);
      expect(amberHtml).toContain('border-amber-500');
      expect(amberHtml).toContain('bg-amber-500');

      const emeraldHtml = renderToString(<GlassCheckboxIndicator checked={true} color="emerald" />);
      expect(emeraldHtml).toContain('border-emerald-500');
      expect(emeraldHtml).toContain('bg-emerald-500');
    });

    it('supports different sizes (sm, md, lg)', () => {
      const smHtml = renderToString(<GlassCheckboxIndicator size="sm" />);
      expect(smHtml).toContain('w-4 h-4');

      const mdHtml = renderToString(<GlassCheckboxIndicator size="md" />);
      expect(mdHtml).toContain('w-4.5 h-4.5');

      const lgHtml = renderToString(<GlassCheckboxIndicator size="lg" />);
      expect(lgHtml).toContain('w-5.5 h-5.5');
    });

    it('supports switch pill variant', () => {
      const offHtml = renderToString(<GlassCheckboxIndicator variant="switch" checked={false} />);
      expect(offHtml).toContain('rounded-full');
      expect(offHtml).toContain('translate-x-0');

      const onHtml = renderToString(<GlassCheckboxIndicator variant="switch" checked={true} />);
      expect(onHtml).toContain('translate-x-4');
      expect(onHtml).toContain('bg-primary');
    });

    it('applies disabled state styling', () => {
      const html = renderToString(<GlassCheckboxIndicator disabled={true} />);
      expect(html).toContain('opacity-40');
      expect(html).toContain('cursor-not-allowed');
    });
  });

  describe('GlassCheckbox Default Inline Variant', () => {
    it('renders standalone checkbox input without labels', () => {
      const html = renderToString(
        <GlassCheckbox name="remember" checked={true} onChange={() => {}} />
      );
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('name="remember"');
      expect(html).toContain('checked=""');
      expect(html).toContain('sr-only');
    });

    it('renders with label and description', () => {
      const html = renderToString(
        <GlassCheckbox
          name="skip"
          checked={false}
          label="Skip preview & translate instantly"
          description="Instant optical character recognition"
          onChange={() => {}}
        />
      );
      expect(html).toContain('Skip preview &amp; translate instantly');
      expect(html).toContain('Instant optical character recognition');
    });

    it('renders with badge and icon', () => {
      const html = renderToString(
        <GlassCheckbox
          name="feature"
          label="Feature"
          badge={<span className="badge-tag">Pro</span>}
          icon={<span className="icon-star">Star</span>}
          checked={true}
          onChange={() => {}}
        />
      );
      expect(html).toContain('badge-tag');
      expect(html).toContain('icon-star');
    });
  });

  describe('GlassCheckbox Switch Variant', () => {
    it('renders switch toggle with label and correct checked state', () => {
      const html = renderToString(
        <GlassCheckbox
          variant="switch"
          name="splash"
          label="Show Splash Screen"
          checked={true}
          onChange={() => {}}
        />
      );
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('Show Splash Screen');
      expect(html).toContain('translate-x-4');
    });
  });

  describe('GlassCheckbox Card Variant', () => {
    it('renders card layout horizontal by default', () => {
      const html = renderToString(
        <GlassCheckbox
          variant="card"
          name="cardOpt"
          label="Card Option"
          description="Detailed option text"
          checked={true}
          onChange={() => {}}
        />
      );
      expect(html).toContain('Card Option');
      expect(html).toContain('Detailed option text');
      expect(html).toContain('bg-primary/10');
      expect(html).toContain('border-primary/50');
    });

    it('renders card layout vertical with icon', () => {
      const html = renderToString(
        <GlassCheckbox
          variant="card"
          cardLayout="vertical"
          name="cardVert"
          icon={<span className="card-icon">Icon</span>}
          label="Vertical Card"
          description="Vertical text"
          checked={false}
          onChange={() => {}}
        />
      );
      expect(html).toContain('card-icon');
      expect(html).toContain('Vertical Card');
      expect(html).toContain('Vertical text');
      expect(html).toContain('flex-col');
    });
  });
});

