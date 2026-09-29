import { findScenario, type ScenarioDefinition } from '../../common/scenarios/catalog';

export type AppRoute =
  | { readonly kind: 'catalog' }
  | { readonly kind: 'scene'; readonly scenario: ScenarioDefinition; readonly objectId?: string; readonly formType?: string }
  | { readonly kind: 'not-found'; readonly pathname: string };

const scenePath = /^\/scenes\/([A-Z]\d{2})(?:(?:\/objects\/([^/]+))|(?:\/new(?:\/([^/]+))?))?\/?$/;

export function resolveRoute(pathname: string): AppRoute {
  if (pathname === '/' || pathname === '') return { kind: 'catalog' };

  const match = scenePath.exec(pathname);
  if (!match) return { kind: 'not-found', pathname };

  const scenario = findScenario(match[1]);
  if (!scenario) return { kind: 'not-found', pathname };
  if (!match[2] && !pathname.includes('/new')) return { kind: 'scene', scenario };

  try {
    if (pathname.includes('/new')) {
      const formType = match[3] ? decodeURIComponent(match[3]) : 'default';
      if (!formType || formType.length > 64) return { kind: 'not-found', pathname };
      return { kind: 'scene', scenario, formType };
    }
    const objectId = decodeURIComponent(match[2]);
    if (!objectId || objectId.length > 128) return { kind: 'not-found', pathname };
    return { kind: 'scene', scenario, objectId };
  } catch {
    return { kind: 'not-found', pathname };
  }
}

export function scopeKeyForRoute(route: AppRoute): string {
  if (route.kind === 'catalog') return 'awcp-examples.catalog';
  if (route.kind === 'not-found') return 'awcp-examples.not-found';
  const base = `awcp-examples.scene.${route.scenario.id}`;
  if (route.objectId) return `${base}.object.${encodeURIComponent(route.objectId)}`;
  if (route.formType) return `${base}.new.${encodeURIComponent(route.formType)}`;
  return base;
}
