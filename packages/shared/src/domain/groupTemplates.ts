export type TemplateChannelType = 'chat' | 'notebook' | 'gallery';

export interface TemplateChannel {
  type: TemplateChannelType;
  title: string;
  description: string;
}

export interface GroupTemplate {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  channels: TemplateChannel[];
}

export const groupTemplates = [
  {
    id: 'book-club',
    title: 'Book Club',
    subtitle: 'Discuss your latest reads',
    description: 'A group for discussing books and literature',
    icon: '📚',
    channels: [
      {
        type: 'chat',
        title: 'Book chat',
        description: 'Discuss books and literature',
      },
      {
        type: 'gallery',
        title: 'Now reading',
        description: 'Share what you\'re currently reading',
      },
      {
        type: 'notebook',
        title: 'Reviews',
        description: 'Write and share book reviews',
      },
    ],
  },
  {
    id: 'cooking-club',
    title: 'Cooking Club',
    subtitle: 'Share recipes and cooking tips',
    description: 'A group for food lovers and home cooks',
    icon: '🍳',
    channels: [
      {
        type: 'chat',
        title: 'Food talk',
        description: 'Chat about cooking and food',
      },
      {
        type: 'gallery',
        title: 'Meal pics',
        description: 'Share photos of your culinary creations',
      },
      {
        type: 'notebook',
        title: 'Recipes',
        description: 'Collect and share your favorite recipes',
      },
    ],
  },
  {
    id: 'music',
    title: 'Music',
    subtitle: 'Share and discover new tunes',
    description: 'A group for music lovers and audiophiles',
    icon: '🎵',
    channels: [
      {
        type: 'chat',
        title: 'Tune talk',
        description: 'Discuss music and artists',
      },
      {
        type: 'gallery',
        title: 'Now listening',
        description: 'Share what you\'re listening to',
      },
      {
        type: 'notebook',
        title: 'Playlists',
        description: 'Curate and share playlists',
      },
    ],
  },
  {
    id: 'running-club',
    title: 'Running Club',
    subtitle: 'Track your runs and stay motivated',
    description: 'A group for runners of all levels',
    icon: '🏃',
    channels: [
      {
        type: 'chat',
        title: 'Run chat',
        description: 'Chat about running and training',
      },
      {
        type: 'gallery',
        title: 'Run pics',
        description: 'Share photos from your runs',
      },
      {
        type: 'notebook',
        title: 'Goals',
        description: 'Track your running goals and progress',
      },
    ],
  },
  {
    id: 'cinema-club',
    title: 'Cinema Club',
    subtitle: 'Discuss and review films',
    description: 'A group for movie enthusiasts and film buffs',
    icon: '🎬',
    channels: [
      {
        type: 'chat',
        title: 'Film chat',
        description: 'Discuss movies and cinema',
      },
      {
        type: 'gallery',
        title: 'Now watching',
        description: 'Share what you\'re currently watching',
      },
      {
        type: 'notebook',
        title: 'Reviews',
        description: 'Write and share film reviews',
      },
    ],
  },
  {
    id: 'garden-club',
    title: 'Garden Club',
    subtitle: 'Grow together',
    description: 'A group for gardeners and plant enthusiasts',
    icon: '🌱',
    channels: [
      {
        type: 'chat',
        title: 'Garden talk',
        description: 'Chat about gardening and plants',
      },
      {
        type: 'gallery',
        title: 'Plant pics',
        description: 'Share photos of your garden and plants',
      },
      {
        type: 'notebook',
        title: 'Tips, plans and schedules',
        description: 'Share gardening tips and track your plans',
      },
    ],
  },
] as const satisfies GroupTemplate[];

// Basic group template used for custom group creation
export const basicGroupTemplate = {
  id: 'basic-group',
  title: 'Basic Group',
  subtitle: 'A basic group with essential channels',
  description: 'A basic group with essential channels',
  icon: '✨',
  channels: [
    {
      type: 'chat',
      title: 'Chat',
      description: 'General chat',
    },
    {
      type: 'gallery',
      title: 'Gallery',
      description: 'Share images',
    },
    {
      type: 'notebook',
      title: 'Notebook',
      description: 'Share notes',
    },
  ],
} as const satisfies GroupTemplate;

export type GroupTemplateId = (typeof groupTemplates)[number]['id'] | typeof basicGroupTemplate.id;

const allTemplates = [...groupTemplates, basicGroupTemplate];

export const groupTemplatesById = allTemplates.reduce(
  (acc, template) => {
    acc[template.id as GroupTemplateId] = template;
    return acc;
  },
  {} as Record<GroupTemplateId, GroupTemplate>
);
