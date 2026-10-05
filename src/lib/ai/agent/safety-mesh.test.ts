import { describe, it, expect } from 'vitest';
import { executeSafetyMeshFallback } from './safety-mesh';

describe('executeSafetyMeshFallback', () => {
  it('provides deterministic delivery response when LLM is unavailable', () => {
    const res = executeSafetyMeshFallback('ডেলিভারি চার্জ কত ভাই?');
    expect(res.recovered).toBe(true);
    expect(res.actionTaken).toBe('RULE_FALLBACK');
    expect(res.replyText).toContain('হোম ডেলিভারি');
  });

  it('provides price fallback reply', () => {
    const res = executeSafetyMeshFallback('দাম কত ভাই?');
    expect(res.recovered).toBe(true);
    expect(res.actionTaken).toBe('RULE_FALLBACK');
    expect(res.replyText).toContain('অফার মূল্য');
  });

  it('escalates to human agent for complex or unknown questions gracefully', () => {
    const res = executeSafetyMeshFallback('আমার বিশেষ রিকোয়ারমেন্ট আছে');
    expect(res.recovered).toBe(true);
    expect(res.actionTaken).toBe('HUMAN_ESCALATION');
    expect(res.replyText).toContain('সাপোর্ট টিম');
  });
});
