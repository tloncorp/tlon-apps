import { Image, Text } from '@tloncorp/ui';
import type { ComponentType } from 'react';
import { View } from 'tamagui';

import AirtableLogo from '../assets/mcp-logos/airtable.png';
import ArenaLogo from '../assets/mcp-logos/arena.svg';
import AtlassianLogo from '../assets/mcp-logos/atlassian.svg';
import GitHubLogo from '../assets/mcp-logos/github.svg';
import LinearLogo from '../assets/mcp-logos/linear.svg';
import NotionLogo from '../assets/mcp-logos/notion.svg';
import PostHogLogo from '../assets/mcp-logos/posthog.svg';
import RefLogo from '../assets/mcp-logos/ref.svg';
import SentryLogo from '../assets/mcp-logos/sentry.svg';
import SupabaseLogo from '../assets/mcp-logos/supabase.png';

type SvgLogoComponent = ComponentType<{
  height: number;
  width: number;
}>;

type ImageLogo = {
  source: number | string;
};

const LOGO_SIZE = 28;
const HOSTING_LOGO_SIZE = 48;

const svgLogos: Partial<Record<string, SvgLogoComponent>> = {
  arena: ArenaLogo,
  atlassian: AtlassianLogo,
  github: GitHubLogo,
  linear: LinearLogo,
  notion: NotionLogo,
  posthog: PostHogLogo,
  ref: RefLogo,
  sentry: SentryLogo,
};

const imageLogos: Partial<Record<string, ImageLogo>> = {
  airtable: { source: AirtableLogo },
  supabase: { source: SupabaseLogo },
};

export function McpProviderLogo({
  displayName,
  logoUrl,
  providerId,
  compact = false,
  size,
}: {
  compact?: boolean;
  displayName: string;
  logoUrl?: string;
  providerId: string;
  /**
   * A tile size in points, overriding the compact and default sizes. Sized
   * tiles crop the catalog's 2:1 logo to its middle square, where the mark
   * sits for nearly every service (wide wordmarks such as Monday's run past
   * it, so only use this for services checked to fit).
   */
  size?: number;
}) {
  const logoSize = size ? Math.round(size * 0.6) : compact ? 20 : LOGO_SIZE;
  const hostingLogoSize = size ?? (compact ? 32 : HOSTING_LOGO_SIZE);
  const containerSize = size ?? (compact ? 32 : '$4xl');
  const SvgLogo = svgLogos[providerId];
  const imageLogo = imageLogos[providerId];
  const fallbackLogo = SvgLogo ? (
    <SvgLogo height={logoSize} width={logoSize} />
  ) : imageLogo ? (
    <Image
      fallback={null}
      height={logoSize}
      source={imageLogo.source}
      width={logoSize}
      contentFit="contain"
    />
  ) : (
    <Text color="$secondaryText" size="$label/l">
      {displayName.slice(0, 1)}
    </Text>
  );

  return (
    <View
      alignItems="center"
      backgroundColor="$secondaryBackground"
      borderColor="$border"
      borderRadius="$s"
      borderWidth={1}
      height={containerSize}
      justifyContent="center"
      overflow="hidden"
      width={containerSize}
    >
      {logoUrl ? (
        <Image
          fallback={fallbackLogo}
          height={hostingLogoSize}
          source={logoUrl}
          width={hostingLogoSize}
          contentFit={size ? 'cover' : 'contain'}
        />
      ) : (
        fallbackLogo
      )}
    </View>
  );
}
