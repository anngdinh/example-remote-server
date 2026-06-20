import { UpstreamProvider } from "./types.js";
import { GoogleProvider } from "./google.js";
import { GitHubProvider } from "./github.js";
import { MockProvider } from "./mock.js";

/**
 * All known upstream identity providers. Mock is always available; Google and
 * GitHub are only usable once their credentials are set via env.
 */
const ALL_PROVIDERS: UpstreamProvider[] = [
  new GoogleProvider(),
  new GitHubProvider(),
  new MockProvider(),
];

/** Look up a provider by slug (regardless of whether it is configured). */
export function getProvider(slug: string): UpstreamProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.slug === slug);
}

/** Providers that have the credentials they need, for rendering the consent page. */
export function getConfiguredProviders(): UpstreamProvider[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured());
}
