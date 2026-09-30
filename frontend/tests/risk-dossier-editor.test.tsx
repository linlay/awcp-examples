import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
import { expect, it } from 'vitest';
import { RiskDossierEditor } from '../src/pc/components/risk/RiskDossierEditor';
import { emptyDossier } from '../src/common/risk/dossier';

function Probe() {
  const [value, setValue] = useState(emptyDossier);
  return (
    <>
      <RiskDossierEditor value={value} onChange={setValue} disabled={false} employees={[]} errors={[]} />
      <output>{JSON.stringify(value)}</output>
    </>
  );
}
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected control not found');
  return value;
}
it('adds independent rows, clears incompatible instruments on market changes and reveals contact fields', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const button = (label: string) =>
    required([...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label)));
  const change = async (label: string, value: string) => {
    const field = required(container.querySelector(`[aria-label="${label}"]`));
    await act(async () =>
      Simulate.change(field, { target: { value } } as unknown as Parameters<typeof Simulate.change>[1])
    );
  };
  try {
    await act(async () => root.render(<Probe />));
    await act(async () => button('新增核查明细').click());
    await change('核查明细 1 市场', 'SH');
    await change('核查明细 1 证券品种', 'DEMO-SH-001');
    expect(container.querySelector('output')?.textContent).toContain('DEMO-SH-001');
    await change('核查明细 1 市场', 'SZ');
    expect(container.querySelector('output')?.textContent).not.toContain('DEMO-SH-001');
    await act(async () => button('新增核查明细').click());
    const firstDelete = required(container.querySelector<HTMLButtonElement>('[aria-label="删除核查明细 1"]'));
    await act(async () => firstDelete.click());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    const contact = required(
      [...container.querySelectorAll('label')]
        .find((l) => l.textContent?.includes('是否需要客户联系'))
        ?.querySelector('select')
    );
    await act(async () =>
      Simulate.change(contact, { target: { value: 'true' } } as unknown as Parameters<typeof Simulate.change>[1])
    );
    expect(container.textContent).toContain('联系日期');
    expect(container.textContent).toContain('沟通记录');
  } finally {
    await act(async () => root.unmount());
  }
});
