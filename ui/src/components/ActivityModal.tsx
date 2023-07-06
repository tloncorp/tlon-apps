import { useDismissNavigate, useModalNavigate } from '@/logic/routing';
import { Link, useLocation } from 'react-router-dom';
import { usePutEntryMutation, useShowActivityMessage } from '@/state/settings';
import { useGroups } from '@/state/groups';
import { useEffect } from 'react';
import Dialog from './Dialog';

export function ActivityChecker() {
  const location = useLocation();
  const navigate = useModalNavigate();
  const groups = useGroups();
  const showActivityMessage = useShowActivityMessage();

  useEffect(() => {
    if (
      Object.keys(groups).length > 0 &&
      showActivityMessage &&
      location.pathname !== '/activity-collection' &&
      !(location.state && 'backgroundLocation' in location.state)
    ) {
      navigate('/activity-collection', {
        state: { backgroundLocation: location },
      });
    }
  }, [groups, showActivityMessage, navigate, location]);

  return null;
}

export default function ActivityModal() {
  const { state } = useLocation();
  const dismiss = useDismissNavigate();
  const { mutate } = usePutEntryMutation({
    bucket: 'groups',
    key: 'showActivityMessage',
  });
  const onContinue = (nav: boolean) => {
    if (nav) {
      dismiss();
    }
    mutate({ val: false });
  };

  return (
    <Dialog
      open
      modal
      close="header"
      className="h-[90vh] w-[90vw] overflow-hidden p-0 sm:h-[75vh] sm:max-h-[440px] sm:w-[75vw] sm:max-w-[800px]"
      onOpenChange={(open) => !open && onContinue(true)}
      onInteractOutside={(e) => e.preventDefault()}
    >
      <div className="flex h-full w-full flex-col">
        <header className="flex items-center space-x-2 border-b-2 border-b-gray-50 p-4">
          <h1 className="font-semibold">Activity Collection</h1>
        </header>
        <section className="flex min-h-0 flex-1 flex-col items-center p-4">
          <div className="prose mb-6 flex-1 overflow-y-auto overflow-x-hidden py-4 dark:prose-invert">
            <h2>Hello out there. This is a data collection notice.</h2>
            <p>Self-hosted? You're opted out by default.</p>
            <p>
              Hosted by Tlon? To continute building products you like using, we
              track some of your interactions with public groups on Landscape.
              We never track the content of your interactions. You can always
              opt out.{' '}
              <Link
                to="/privacy"
                state={{ backgroundLocation: state.backgroundLocationn }}
              >
                Learn more here.
              </Link>
            </p>
          </div>
          <footer className="mt-auto flex items-center justify-end space-x-2 self-stretch">
            <Link
              to="/settings"
              state={{ backgroundLocation: state.backgroundLocation }}
              className="secondary-button"
              onClick={() => onContinue(false)}
            >
              App Settings
            </Link>
            <button className="button" onClick={() => onContinue(true)}>
              Continue
            </button>
          </footer>
        </section>
      </div>
    </Dialog>
  );
}
