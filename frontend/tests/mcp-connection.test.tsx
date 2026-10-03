import { DemoApi } from '@app/api';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DemoSessionContext, type DemoSessionContextValue } from '../src/app/demoSessionContext';
import { McpConnection } from '../src/pc/components/McpConnection';
import { getMcpConnection } from '../src/pc/service/mcpConnection';

const context: DemoSessionContextValue = {
  session: {
    id: 'demo',
    generation: 'one',
    seed: 1,
    datasetVersion: 'v1',
    profile: 'acceptance',
    simulatedAt: '2026-10-03',
    expiresAt: '2026-10-04',
    employees: [],
    departments: [],
    recordCount: 48,
    mcpAvailable: true,
    mcpConnectUrl: 'https://demo.example:8443/api/v1/mcp/connect'
  },
  api: new DemoApi(),
  reset: async () => undefined,
  refresh: async () => undefined
};
const container = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;
const getComputedStyle = window.getComputedStyle.bind(window);

beforeEach(() => {
  // jsdom does not implement pseudo-element styles used by the modal's scrollbar measurement.
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => getComputedStyle(element));
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openConnection(value: DemoSessionContextValue | null = context) {
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <DemoSessionContext.Provider value={value}>
        <McpConnection />
      </DemoSessionContext.Provider>
    )
  );
  await act(async () => container.querySelector('button')?.click());
}

it('uses the configured backend origin for the MCP and OAuth discovery addresses', () => {
  expect(getMcpConnection(context.session)).toEqual({
    connectUrl: 'https://demo.example:8443/api/v1/mcp/connect',
    serverUrl: 'https://demo.example:8443/mcp',
    resourceMetadataUrl: 'https://demo.example:8443/.well-known/oauth-protected-resource/mcp',
    authorizationMetadataUrl: 'https://demo.example:8443/.well-known/oauth-authorization-server'
  });
  for (const mcpConnectUrl of [
    'javascript:alert(1)',
    'https://user:pass@demo.example/api/v1/mcp/connect',
    '/api/v1/mcp/connect',
    'https://demo.example/other',
    'https://demo.example/api/v1/mcp/connect?token=secret'
  ]) {
    expect(getMcpConnection({ mcpAvailable: true, mcpConnectUrl })).toBeNull();
  }
  expect(getMcpConnection({ ...context.session, mcpAvailable: false })).toBeNull();
  expect(getMcpConnection(undefined)).toBeNull();
});

it('shows both connection methods, opens login separately, and copies only the server URL', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  await openConnection();
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('OAuth 授权');
  expect(dialog?.textContent).toContain('Authorization: Bearer <Access Token>');
  const login = dialog?.querySelector<HTMLAnchorElement>('a[href$="/api/v1/mcp/connect"]');
  expect(login?.href).toBe(context.session.mcpConnectUrl);
  expect(login?.target).toBe('_blank');
  expect(login?.rel).toContain('noopener');
  const copy = Array.from(dialog?.querySelectorAll('button') ?? []).find((button) =>
    button.textContent?.includes('复制地址')
  );
  await act(async () => copy?.click());
  expect(writeText).toHaveBeenCalledTimes(1);
  expect(writeText).toHaveBeenCalledWith('https://demo.example:8443/mcp');
  expect(dialog?.querySelector('[role="status"]')?.textContent).toBe('地址已复制');
});

it('selects the URL for manual copy when clipboard access fails', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
  await openConnection();
  const dialog = document.querySelector('[role="dialog"]');
  const copy = Array.from(dialog?.querySelectorAll('button') ?? []).find((button) =>
    button.textContent?.includes('复制地址')
  );
  await act(async () => copy?.click());
  const input = dialog?.querySelector<HTMLInputElement>('input');
  expect(document.activeElement).toBe(input);
  expect(input?.selectionStart).toBe(0);
  expect(input?.selectionEnd).toBe(input?.value.length);
  expect(dialog?.textContent).toContain('自动复制失败，请手动复制地址。');
});

it.each([null, { ...context, session: { ...context.session, mcpAvailable: false } }])(
  'does not invent a connection address when the service is unavailable',
  async (value) => {
    await openConnection(value);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('input')).toBeNull();
    expect(dialog?.textContent).toContain(value ? '当前服务未启用 MCP。' : '暂时无法获取 MCP 连接信息');
  }
);
