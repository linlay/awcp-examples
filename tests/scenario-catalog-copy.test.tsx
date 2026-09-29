import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { expect, it, vi } from 'vitest';

import ScenarioCatalogPage from '../src/pc/pages/ScenarioCatalogPage';

it('copies demo tasks or selects their text when clipboard access is denied', async () => {
  const previousClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const previousExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
  const writeText = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new DOMException('Write permission denied', 'NotAllowedError'))
    .mockRejectedValueOnce(new DOMException('Write permission denied', 'NotAllowedError'));
  const legacyCopy = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: legacyCopy });

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => root.render(<ScenarioCatalogPage navigate={() => undefined} />));
    const buttons = container.querySelectorAll<HTMLButtonElement>('section[aria-label="自然语言演示任务"] button');
    expect(buttons).toHaveLength(3);

    await act(async () => {
      buttons[0].click();
    });
    expect(writeText).toHaveBeenCalledWith(buttons[0].previousElementSibling?.textContent);
    expect(buttons[0].parentElement?.querySelector('[role="status"]')?.textContent).toBe('已复制');
    expect(legacyCopy).not.toHaveBeenCalled();

    await act(async () => {
      buttons[1].click();
    });
    expect(legacyCopy).toHaveBeenCalledTimes(1);
    expect(buttons[1].parentElement?.querySelector('[role="status"]')?.textContent).toBe('已复制');

    await act(async () => {
      buttons[2].click();
    });
    expect(legacyCopy).toHaveBeenCalledTimes(2);
    expect(buttons[2].parentElement?.querySelector('[role="status"]')?.textContent).toContain('文字已选中');
    expect(window.getSelection()?.toString()).toBe(buttons[2].previousElementSibling?.textContent);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    window.getSelection()?.removeAllRanges();
    if (previousClipboard) Object.defineProperty(navigator, 'clipboard', previousClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    if (previousExecCommand) Object.defineProperty(document, 'execCommand', previousExecCommand);
    else Reflect.deleteProperty(document, 'execCommand');
  }
});
