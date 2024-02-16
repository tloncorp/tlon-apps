import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import Dialog from '@/components/Dialog';
import { useDismissNavigate } from '@/logic/routing';

export function PrivacyContents({ className }: { className?: string }) {
  const { state } = useLocation();
  return (
    <div className={className}>
      <div className="prose mx-auto py-4 dark:prose-invert">
        <h2>Dear friends, fans, and customers,</h2>
        <p>
          You&rsquo;re reading this note because you&rsquo;re concerned about
          the privacy of your data. We&rsquo;ve published this notice because
          we&rsquo;re concerned too (it&rsquo;s part of the reason we built
          Urbit, after all).
        </p>
        <p>
          Urbit was built to give people power over their computing. Ownership
          and self-sovereignty remain foundational principles of both the
          network-at-large and Tlon.
        </p>
        <p>
          Still, we build software and offer Hosting services. Inevitably we
          have to collect some data for you to use our product. As an example,
          to sign up for a hosted ship, you give us your email.
        </p>
        <p>
          If you use Landscape, you can help us make it better by allowing
          surface level data collection about your use. What do we mean by
          surface level?
        </p>
        <ul>
          <li>The names of public groups you join.</li>
          <li>
            The names of public channels you post in and the type of channel.
          </li>
          <li>
            The <strong>types</strong> of channels you use in private groups.
          </li>
        </ul>
        <p>
          By default,{' '}
          <em>
            we never track anything you do on Landscape as a self-hosted user.
          </em>{' '}
          However, you can opt in to help us. If you&rsquo;re piloting a
          Tlon-hosted ship, we collect surface level data about your ship
          activity unless you opt out,{' '}
          <Link
            to="/settings"
            className=""
            state={{ backgroundLocation: state.backgroundLocation }}
          >
            which you can do in App Settings
          </Link>
          . You can also ask that all your activity data be deleted by sending
          an email to <a href="mailto:support@tlon.io">support@tlon.io</a>{' '}
          (which we are compelled to do by GDPR).
        </p>
        <p>
          Let&rsquo;s get specific. We track the names of public groups you
          interact with, including the type of channel and channel name. In
          private groups, we only track the type of channel you interact with
          (e.g. chat, gallery, or notebook). If you interact with a secret
          group, we will never track anything you do in it.
        </p>
        <p>
          Whether you&rsquo;re self-hosting or using a hosted ship,{' '}
          <em>we will never track any interactions over direct messages.</em> We
          will never track the content of messages you post anywhere on the
          network. We will never track the content of posts you view.
        </p>
        <p>
          Tlon doesn&rsquo;t and will never collect your data without
          permission. We will never sell your data. We will never use your data
          without explaining why or what we&rsquo;re doing with anything
          we&rsquo;ve collected.
        </p>
        <p>
          The most important point you should take away from this disclosure is
          our continued commitment to transparency. We&rsquo;re not trying to
          pull one over on you. You can{' '}
          <Link
            to="/settings"
            className=""
            state={{ backgroundLocation: state.backgroundLocation }}
          >
            opt out in App Settings
          </Link>{' '}
          whenever you want.
        </p>
        <p>
          Thank you for trusting us with your data and affording valuable
          insight. For a more granular understanding of the type of data we
          collect and how we use it, take a look at the table below.
        </p>
        <p>
          As always, we&rsquo;re here to address any concerns you may have. Drop
          us a line in <Link to="/groups/~nibset-napwyn/tlon">Tlon Local</Link>{' '}
          or <a href="mailto:support@tlon.io">send an email</a>.
        </p>
        <h2>What we track and why</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Example</th>
              <th>When</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Contact</td>
              <td>Email</td>
              <td>
                Automatically, when you sign up for a Tlon Hosting account
              </td>
              <td>
                So you can log into your account and to send activity you missed
                through notifications
              </td>
            </tr>
            <tr>
              <td>Contact</td>
              <td>Email, @p</td>
              <td>
                Automatically, when you sign up for Tlon&rsquo;s newsletter
              </td>
              <td>To send you updates about Landscape</td>
            </tr>

            <tr>
              <td>Product usage</td>
              <td>
                Public group interaction — group name, channel name, channel
                type
              </td>
              <td>
                If you opt in: when you post a chat, gallery link, or notebook
              </td>
              <td>To understand how often certain features are used</td>
            </tr>
            <tr>
              <td>Product usage</td>
              <td>Private group interaction — channel type</td>
              <td>
                If you opt in: when you post a chat, gallery link, or notebook
              </td>
              <td>To understand how often certain features are used</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PrivacyNotice() {
  const dismiss = useDismissNavigate();

  const onOpenChange = (open: boolean) => {
    if (!open) {
      dismiss();
    }
  };

  return (
    <Dialog
      defaultOpen
      modal
      onOpenChange={onOpenChange}
      close="header"
      className="h-[90vh] w-[90vw] overflow-hidden p-0 sm:h-[75vh] sm:max-h-[800px] sm:w-[75vw] sm:max-w-[800px]"
      onInteractOutside={(e) => e.preventDefault()}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center space-x-2 border-b-2 border-b-gray-50 p-4">
          <h2 className="font-semibold">Privacy Statement</h2>
        </div>
        <PrivacyContents className="h-full overflow-auto p-4" />
      </div>
    </Dialog>
  );
}
