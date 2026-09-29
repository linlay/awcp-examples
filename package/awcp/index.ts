/** Agent Web Capability Protocol (AWCP) public API. */
export { exposeCurrentAwcpRegistryToWindow } from './bridge';
export { getCurrentAwcpManual, getCurrentAwcpRegistry, invokeCurrentAwcpAction } from './current';
export { AwcpActionError } from './error';
export { cloneJson, cloneJsonObject, isJsonObject } from './json';
export { AwcpProvider } from './provider';
export type { AwcpProviderProps } from './provider';
export { useAwcpAction, useAwcpInvocation, useAwcpRegistry } from './hooks';
export { AWCP_ACTION_PATTERN, AWCP_LIMITS, createAwcpRegistry } from './registry';
export type {
  AwcpActionRegistration,
  AwcpActionRegistrationHandle,
  AwcpActionResponse,
  AwcpBrowserApi,
  AwcpBrowserInvokeRequest,
  AwcpError,
  AwcpErrorCode,
  AwcpInvocationContext,
  AwcpInvocationEvent,
  AwcpInvocationListener,
  AwcpInvokeOptions,
  AwcpFieldError,
  AwcpFieldPath,
  AwcpManualError,
  AwcpManualIndex,
  AwcpManualRequest,
  AwcpManualSectionRequest,
  AwcpManualSection,
  AwcpManualSectionSummary,
  AwcpRegistry,
  AwcpSiteInfo,
  AwcpUnregister,
  AwcpValidateMessages,
  AwcpValidationContext,
  JsonObject,
  JsonPrimitive,
  JsonSchema,
  JsonValue
} from './types';
