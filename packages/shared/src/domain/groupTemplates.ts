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
        title: 'General',
        description: 'General book discussion',
      },
      {
        type: 'notebook',
        title: 'Reading List',
        description: 'Share and track your reading list',
      },
      {
        type: 'gallery',
        title: 'Book Photos',
        description: 'Share photos of your favorite books',
      },
    ],
  },
  {
    id: 'hat-club',
    title: 'Hat Club',
    subtitle: 'Share your favorite hats',
    description: 'A group for hat enthusiasts and collectors',
    icon: '🎩',
    channels: [
      {
        type: 'chat',
        title: 'General',
        description: 'Chat about hats',
      },
      {
        type: 'gallery',
        title: 'Hat Collection',
        description: 'Share photos of your hat collection',
      },
    ],
  },
  {
    id: 'lobster-club',
    title: 'Lobster Club',
    subtitle: 'For lobster enthusiasts',
    description: 'A group for people who love lobsters',
    icon: '🦞',
    channels: [
      {
        type: 'chat',
        title: 'General',
        description: 'Talk about lobsters',
      },
      {
        type: 'notebook',
        title: 'Lobster Recipes',
        description: 'Share your favorite lobster recipes',
      },
      {
        type: 'gallery',
        title: 'Lobster Photos',
        description: 'Share photos of lobsters',
      },
    ],
  },
] as const satisfies GroupTemplate[];

export type GroupTemplateId = (typeof groupTemplates)[number]['id'];

export const groupTemplatesById = groupTemplates.reduce<
  Record<GroupTemplateId, GroupTemplate>
>(
  (acc, template) => {
    acc[template.id] = template;
    return acc;
  },
  {} as Record<GroupTemplateId, GroupTemplate>
);
