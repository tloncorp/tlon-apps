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

type LogoDimensions = {
  height: number;
  width: number;
};

type SvgLogoComponent = ComponentType<{
  height: number;
  width: number;
}>;

type SvgLogo = {
  Component: SvgLogoComponent;
  dimensions: LogoDimensions;
};

type ImageLogo = {
  dimensions: LogoDimensions;
  source: number | string;
};

const svgLogos: Partial<Record<string, SvgLogo>> = {
  arena: { Component: ArenaLogo, dimensions: { height: 22, width: 34 } },
  atlassian: {
    Component: AtlassianLogo,
    dimensions: { height: 25, width: 25 },
  },
  github: { Component: GitHubLogo, dimensions: { height: 26, width: 26 } },
  linear: { Component: LinearLogo, dimensions: { height: 26, width: 26 } },
  notion: { Component: NotionLogo, dimensions: { height: 28, width: 28 } },
  posthog: { Component: PostHogLogo, dimensions: { height: 20, width: 34 } },
  ref: { Component: RefLogo, dimensions: { height: 27, width: 27 } },
  sentry: { Component: SentryLogo, dimensions: { height: 26, width: 26 } },
};

const imageLogos: Partial<Record<string, ImageLogo>> = {
  airtable: { dimensions: { height: 28, width: 28 }, source: AirtableLogo },
  supabase: { dimensions: { height: 29, width: 28 }, source: SupabaseLogo },
};

export function McpProviderLogo({
  displayName,
  providerId,
}: {
  displayName: string;
  providerId: string;
}) {
  const svgLogo = svgLogos[providerId];
  const imageLogo = imageLogos[providerId];

  return (
    <View
      alignItems="center"
      backgroundColor="#FFFFFF"
      borderColor="$border"
      borderRadius="$s"
      borderWidth={1}
      height="$4xl"
      justifyContent="center"
      overflow="hidden"
      width="$4xl"
    >
      {svgLogo ? (
        <svgLogo.Component
          height={svgLogo.dimensions.height}
          width={svgLogo.dimensions.width}
        />
      ) : imageLogo ? (
        <Image
          fallback={null}
          height={imageLogo.dimensions.height}
          source={imageLogo.source}
          width={imageLogo.dimensions.width}
          contentFit="contain"
        />
      ) : (
        <Text color="$secondaryText" size="$label/l">
          {displayName.slice(0, 1)}
        </Text>
      )}
    </View>
  );
}
