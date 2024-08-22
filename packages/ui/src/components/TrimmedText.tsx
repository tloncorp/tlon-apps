import { Text, styled } from 'tamagui';

export const Emoji = styled(Text, {
  variants: {
    size: {
      $m: {
        fontSize: 21,
        lineHeight: 24,
        letterSpacing: -0.264,
      },
      $l: {
        fontSize: 36,
        lineHeight: 40,
        letterSpacing: -0.396,
      },
    },
    trimmed: (value: boolean, { props }) => {
      if (!value) return {};
      const size: string = (props as { size: string }).size;
      return (
        {
          $m: {
            '$platform-ios': trimStyle(-1, -1),
            '$platform-android': trimStyle(0, -2),
          },
          $l: {
            '$platform-ios': trimStyle(-2, -5),
            '$platform-android': trimStyle(0, -3),
          },
        }[size] ?? {}
      );
    },
  } as const,
});

export const BodyText = styled(Text, {
  fontSize: 16,
  lineHeight: 24,
  letterSpacing: -0.2,
  fontWeight: '500',
  variants: {
    trimmed: {
      true: {
        '$platform-ios': trimStyle(-6, -6),
        '$platform-android': trimStyle(-6, -5),
      },
    },
  } as const,
});

export const BigTitleText = styled(Text, {
  fontSize: 34,
  lineHeight: 34,
  letterSpacing: -0.2,
  fontWeight: '500',
  variants: {
    trimmed: {
      true: {
        '$platform-ios': trimStyle(-2, -8),
        '$platform-android': trimStyle(0, -8),
      },
    },
  } as const,
});

export const LabelText = styled(Text, {
  variants: {
    size: {
      $s: {
        fontSize: 12,
        lineHeight: 12,
        letterSpacing: 0,
        fontWeight: '400',
      },
      $m: {
        fontSize: 14,
        lineHeight: 20,
        letterSpacing: -0.08,
        fontWeight: '400',
      },
      $l: {
        fontSize: 16,
        lineHeight: 24,
        letterSpacing: -0.2,
        fontWeight: '500',
      },
      $xl: {
        fontSize: 17,
        lineHeight: 24,
        letterSpacing: -0.2,
        fontWeight: '400',
      },
      $2xl: {
        fontSize: 17,
        lineHeight: 24,
        letterSpacing: -0.2,
        fontWeight: '500',
      },
      $3xl: {
        fontSize: 20,
        lineHeight: 22,
        letterSpacing: -0.408,
      },
    },
    trimmed: (value: boolean, { props }) => {
      if (!value) return {};
      const size: string = (props as any).size;
      return (
        {
          $s: {
            '$platform-ios': trimStyle(0, -2),
            '$platform-android': trimStyle(0, -3),
          },
          $m: {
            '$platform-ios': trimStyle(-5, -5),
            '$platform-android': trimStyle(-5, -4),
          },
          $l: {
            '$platform-ios': trimStyle(-6, -6),
            '$platform-android': trimStyle(-6, -5),
          },
          $xl: {
            '$platform-ios': trimStyle(-6, -6),
            '$platform-android': trimStyle(-6, -5),
          },
          $2xl: {
            '$platform-ios': trimStyle(-6, -6),
            '$platform-android': trimStyle(-6, -5),
          },
          $3xl: {
            '$platform-ios': trimStyle(-6, -6),
            '$platform-android': trimStyle(-6, -5),
          },
        }[size] ?? {}
      );
    },
  } as const,
  defaultVariants: {
    trimmed: true,
  },
});

// Todo: import mono font
export const MonoText = styled(Text, {
  variants: {
    size: {
      $s: {
        fontSize: 12,
        lineHeight: 20,
        letterSpacing: 0,
        fontWeight: '500',
      },
      $m: {
        fontSize: 14,
        lineHeight: 24,
        letterSpacing: 0,
        fontWeight: '500',
      },
    },
    trimmed: (value: boolean, { props }) => {
      if (!value) return {};
      const size: string = (props as any).size;
      return (
        {
          $s: {
            '$platform-ios': trimStyle(-6, -6),
            '$platform-android': trimStyle(-6, -5),
          },
          $m: {
            '$platform-ios': trimStyle(-6, -6),
            '$platform-android': trimStyle(-6, -5),
          },
        }[size] ?? {}
      );
    },
  } as const,
});

function trimStyle(marginTop: number, marginBottom: number) {
  return {
    marginTop,
    marginBottom,
  };
}
