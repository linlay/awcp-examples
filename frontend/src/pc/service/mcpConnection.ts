import type { DemoSession } from '@app/api';

export function getMcpConnection(session: Pick<DemoSession, 'mcpAvailable' | 'mcpConnectUrl'> | undefined) {
  if (!session?.mcpAvailable || !session.mcpConnectUrl) return null;
  try {
    const connect = new URL(session.mcpConnectUrl);
    if (
      !['http:', 'https:'].includes(connect.protocol) ||
      connect.username ||
      connect.password ||
      connect.search ||
      connect.hash ||
      connect.pathname !== '/api/v1/mcp/connect'
    )
      return null;
    // The backend requires AWCP_MCP_PUBLIC_URL to use the exact /mcp path.
    return {
      connectUrl: connect.href,
      serverUrl: new URL('/mcp', connect).href,
      resourceMetadataUrl: new URL('/.well-known/oauth-protected-resource/mcp', connect).href,
      authorizationMetadataUrl: new URL('/.well-known/oauth-authorization-server', connect).href
    };
  } catch {
    return null;
  }
}
