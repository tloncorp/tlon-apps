import cn from 'classnames';
import useEmoji from '@/state/emoji';
import { useCurrentTheme } from '@/state/local';
import { useEffect } from 'react';
import WidgetDrawer from '@/components/WidgetDrawer';
import Picker from '@emoji-mart/react';

export default function ReactionSheet({
  open,
  onOpenChange,
  onEmojiSelect,
}: {
  open: boolean;
  onOpenChange: (change: boolean) => void;
  onEmojiSelect: (shortcode: string) => void;
}) {
  const { data, load } = useEmoji();
  const currentTheme = useCurrentTheme();
  const emojisPerLine = Math.floor((window.innerWidth - 20) / 48);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const rgbValue = currentTheme === 'light' ? '255, 255, 255' : '0, 0, 0';

    // if we have the elements right away, set the variables and return
    const pickerEl = document.querySelector('em-emoji-picker');
    const pickerContainerEl = document.getElementById('pickerContainer');
    if (pickerEl && pickerContainerEl) {
      const picker = pickerEl as HTMLDivElement;
      const pickerContainer = pickerContainerEl as HTMLDivElement;

      picker.style.height = `${pickerContainer.clientHeight}px`;
      picker.style.setProperty('--rgb-background', rgbValue);
      return function () {
        return null;
      };
    }

    // otherwise, we need to wait for the elements to be added to the DOM,
    // and do the same
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log(JSON.stringify(mutation, null, 2));
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            console.log('checking node', node.nodeName);
            if (node.nodeName.toLowerCase() === 'em-emoji-picker') {
              console.log('found picker!');
              const picker = node as HTMLDivElement;
              const pickerContainer =
                document.getElementById('pickerContainer');
              console.log('height:', pickerContainer?.clientHeight);
              if (pickerContainer) {
                picker.style.height = `${pickerContainer.clientHeight}px`;
                picker.style.setProperty('--rgb-background', rgbValue);
                picker.style.setProperty('--color-border', 'black');
                observer.disconnect();
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [currentTheme]);

  return (
    <WidgetDrawer
      open={open}
      onOpenChange={onOpenChange}
      hideOverlay
      // snapPoints={[0.6, 0.8]} activeSnapPoint={currSnapPoint} setActiveSnapPoint={setSnapPoint}
      className={cn('h-[70vh]')}
    >
      <div
        id="pickerContainer"
        className="mx-4 mt-8 h-full"
        onTouchMove={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Picker
          data={data}
          autoFocus={false}
          previewPosition="none"
          navPosition="none"
          skinTonePosition="none"
          searchPosition="sticky"
          emojiButtonSize={48}
          emojiSize={32}
          perLine={emojisPerLine}
          dynamicWidth={true}
          theme={currentTheme}
          onEmojiSelect={({ shortcodes }: { shortcodes: string }) =>
            onEmojiSelect(shortcodes)
          }
        />
      </div>
    </WidgetDrawer>
  );
}
