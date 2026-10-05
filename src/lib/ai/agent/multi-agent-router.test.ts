import { describe, it, expect } from 'vitest';
import { routeToSpecializedAgent } from './multi-agent-router';

describe('routeToSpecializedAgent', () => {
  it('routes to POST_PURCHASE_SUPPORT when customer asks tracking questions', () => {
    const res = routeToSpecializedAgent('আমার পার্সেল কবে পাব?', 'NEW', true);
    expect(res.targetRole).toBe('POST_PURCHASE_SUPPORT');
    expect(res.roleTitle).toContain('Support');
  });

  it('routes to BARGAIN_NEGOTIATOR when customer bargains on price', () => {
    const res = routeToSpecializedAgent('দাম কি কিছু কম রাখা যাবে ভাই?', 'NEW', false);
    expect(res.targetRole).toBe('BARGAIN_NEGOTIATOR');
    expect(res.roleTitle).toContain('Negotiator');
  });

  it('routes to SALES_CLOSER for general product inquiry', () => {
    const res = routeToSpecializedAgent('এই ঘড়িটির দাম কত এবং কী কী কালার আছে?', 'NEW', false);
    expect(res.targetRole).toBe('SALES_CLOSER');
    expect(res.roleTitle).toContain('Sales');
  });
});
